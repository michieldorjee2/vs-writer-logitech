import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Live edit-mode streaming endpoint. Replaces the fire-and-forget
 * `/api/opal-feedback` webhook with a streamed run of the
 * `account_page_live_edit` Opal specialized agent: the agent narrates
 * its thinking and each edit as line-delimited JSON, then commits one
 * `update_page` at the end. We re-emit a clean SSE stream the browser
 * animates on the page.
 *
 * Browser-bound SSE messages (one JSON object per `data:` line):
 *   { k: "text",  t }                      — raw agent text chunk (JSONL)
 *   { k: "tool",  name, phase, ok? }       — get_page / update_page activity
 *   { k: "done" }                          — execution complete
 *   { k: "error", message }
 *
 * Env (set on the Vercel project): OPAL_PAT (required), OPAL_BASE_URL,
 * OPAL_INSTANCE_ID, OPAL_AGENT_ID.
 */

export const config = { maxDuration: 300 };

const BASE_URL = process.env.OPAL_BASE_URL || 'https://opal.optimizely.com';
const INSTANCE_ID = process.env.OPAL_INSTANCE_ID || '4f42a24e93f945bcb262bff01a9a1562';
const AGENT_ID = process.env.OPAL_AGENT_ID || '6c6d1d88-55ee-4f9c-a2d3-28de4bee1149';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

function toolName(p: Record<string, unknown>): string {
  return str(p['tool_name']) ?? str(p['name']) ?? str(p['tool']) ?? str(p['function_name']) ?? 'tool';
}

/** POST /stream-execute and yield normalised {eventType, payload} events. */
async function* streamAgent(
  pat: string,
  parameters: Record<string, unknown>,
  signal: AbortSignal,
): AsyncGenerator<{ eventType: string; payload: Record<string, unknown> }> {
  const url = `${BASE_URL.replace(/\/+$/, '')}/hypatia/api/v1/${INSTANCE_ID}/agents/specialized/${AGENT_ID}/stream-execute`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pat}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'X-Instance-Id': INSTANCE_ID,
      'X-Request-Id': crypto.randomUUID(),
    },
    body: JSON.stringify({ parameters }),
    signal,
  });
  if (!res.ok || !res.body) {
    const preview = await res.text().catch(() => '');
    throw new Error(`stream-execute HTTP ${res.status}: ${preview.slice(0, 300)}`);
  }
  const reader = (res.body as any).getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let dataLines: string[] = [];
  const flush = () => {
    if (!dataLines.length) return undefined;
    const json = dataLines.join('\n').trim();
    dataLines = [];
    if (!json) return undefined;
    let raw: any;
    try { raw = JSON.parse(json); } catch { return undefined; }
    if (!raw || typeof raw !== 'object') return undefined;
    const eventType = raw.event_type;
    if (typeof eventType !== 'string' || !eventType) return undefined;
    const rawPayload = 'payload' in raw ? raw.payload : raw.data;
    const payload = rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload) ? rawPayload : {};
    return { eventType, payload };
  };
  const handle = (line: string) => {
    if (line === '') return flush();
    if (line.startsWith(':')) return undefined;
    if (line.startsWith('data:')) {
      let v = line.slice(5);
      if (v.startsWith(' ')) v = v.slice(1);
      dataLines.push(v);
    }
    return undefined;
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf('\n')) !== -1) {
        let line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        const ev = handle(line);
        if (ev) yield ev;
      }
    }
    const tail = (buf + decoder.decode()).replace(/\r$/, '');
    if (tail) handle(tail);
    const last = flush();
    if (last) yield last;
  } finally {
    try { await reader.cancel(); } catch { /* closed */ }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { company_name, company_slug, suggested_edit, edit_user_email } = (req.body ?? {}) as Record<string, unknown>;
  if (
    typeof company_name !== 'string' || !company_name.trim() ||
    typeof company_slug !== 'string' || !company_slug.trim() ||
    typeof suggested_edit !== 'string' || !suggested_edit.trim() ||
    typeof edit_user_email !== 'string' || !EMAIL_RE.test(edit_user_email)
  ) {
    return res.status(400).json({ error: 'Missing or invalid fields' });
  }

  const pat = process.env.OPAL_PAT;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const send = (msg: Record<string, unknown>) => res.write(`data: ${JSON.stringify(msg)}\n\n`);

  if (!pat) {
    send({ k: 'error', message: 'Server is missing OPAL_PAT.' });
    return res.end();
  }

  const ac = new AbortController();
  req.on('close', () => ac.abort());

  const toolNames = new Map<string, string>();
  try {
    for await (const ev of streamAgent(
      pat,
      { company_name, company_slug, suggested_edit, edit_user_email },
      ac.signal,
    )) {
      const p = ev.payload;
      const execId = str(p['execution_id']);
      switch (ev.eventType) {
        case 'response_chunk': {
          const t = str(p['content']) ?? str(p['chunk']);
          if (t) send({ k: 'text', t });
          break;
        }
        case 'tool_call': {
          const name = toolName(p);
          if (execId) toolNames.set(execId, name);
          send({ k: 'tool', name, phase: 'call' });
          break;
        }
        case 'tool_result': {
          const name = (execId && toolNames.get(execId)) || toolName(p);
          const hasErr = 'error' in p && p['error'] != null;
          send({ k: 'tool', name, phase: 'result', ok: !hasErr });
          break;
        }
        case 'error':
          send({ k: 'error', message: str(p['error_message']) ?? str(p['message']) ?? 'agent execution failed' });
          break;
        default:
          break;
      }
    }
    send({ k: 'done' });
  } catch (err) {
    send({ k: 'error', message: err instanceof Error ? err.message : String(err) });
  }
  res.end();
}
