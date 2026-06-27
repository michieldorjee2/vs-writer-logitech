/**
 * Client for the live edit-mode stream (`/api/opal-edit-stream`).
 *
 * Reads the SSE the route emits, accumulates the agent's text, and pulls
 * out each complete top-level JSON object with a brace-depth scanner —
 * robust to the model concatenating objects ("}{") or leaking prose
 * (both seen live). Yields normalised events the overlay animates.
 */

export type EditAction = 'replace' | 'remove' | 'add';
export type EditKind = 'text' | 'item-add' | 'item-remove' | 'image' | 'color';

export type EditEvent = {
  type: 'edit';
  index?: number;
  section: string;
  target?: string;
  /** How the UI should animate this edit. Falls back to inference from `action`. */
  kind?: EditKind;
  action?: EditAction;
  status?: 'applied' | 'skipped';
  reason?: string;
  old?: string;
  new?: string;
  /** For kind:"image" — the new image URL to swap in. */
  newUrl?: string;
};

export type AgentEvent =
  | { type: 'plan'; company?: string; slug?: string; editor?: string; sections?: string[]; summary?: string }
  | { type: 'section_focus'; section: string; note?: string }
  | EditEvent
  | { type: 'commit'; status?: string; edits?: number }
  | { type: 'done'; saved?: boolean; page_url?: string; changes?: string[]; skipped?: string[] }
  | { type: 'error'; saved?: boolean; message?: string };

/** Normalise an edit's kind (the agent may send only the legacy `action`). */
export function editKind(e: EditEvent): EditKind {
  if (e.kind) return e.kind;
  if (e.action === 'add') return 'item-add';
  if (e.action === 'remove') return 'item-remove';
  return 'text';
}

export type LiveEvent =
  | { kind: 'agent'; ev: AgentEvent }
  | { kind: 'tool'; name: string; phase: 'call' | 'result'; ok?: boolean }
  | { kind: 'error'; message: string };

export interface EditStreamPayload {
  company_name: string;
  company_slug: string;
  suggested_edit: string;
  edit_user_email: string;
}

/** Pull every complete top-level {…} object out of `buf`; return the rest. */
function drainObjects(buf: string): { objects: AgentEvent[]; rest: string } {
  const objects: AgentEvent[] = [];
  let depth = 0, inStr = false, esc = false, start = -1, consumed = 0;
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') { if (depth === 0) start = i; depth++; }
    else if (c === '}' && depth > 0) {
      depth--;
      if (depth === 0 && start >= 0) {
        try { objects.push(JSON.parse(buf.slice(start, i + 1)) as AgentEvent); } catch { /* drop */ }
        consumed = i + 1;
        start = -1;
      }
    }
  }
  const rest = depth > 0 && start >= 0 ? buf.slice(start) : buf.slice(consumed);
  return { objects, rest };
}

export async function* streamEdit(
  payload: EditStreamPayload,
  signal?: AbortSignal,
): AsyncGenerator<LiveEvent, void, undefined> {
  const res = await fetch('/api/opal-edit-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok || !res.body) {
    yield { kind: 'error', message: `Stream failed (HTTP ${res.status})` };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let sse = '';
  let agentText = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    sse += decoder.decode(value, { stream: true });
    let bnd: number;
    while ((bnd = sse.indexOf('\n\n')) !== -1) {
      const block = sse.slice(0, bnd);
      sse = sse.slice(bnd + 2);
      const dataLine = block.split('\n').find((l) => l.startsWith('data:'));
      if (!dataLine) continue;
      let msg: any;
      try { msg = JSON.parse(dataLine.slice(5).trim()); } catch { continue; }
      if (msg.k === 'text') {
        agentText += msg.t;
        const { objects, rest } = drainObjects(agentText);
        agentText = rest;
        for (const ev of objects) yield { kind: 'agent', ev };
      } else if (msg.k === 'tool') {
        yield { kind: 'tool', name: msg.name, phase: msg.phase, ok: msg.ok };
      } else if (msg.k === 'error') {
        yield { kind: 'error', message: msg.message };
      }
      // k:done — stream simply ends after
    }
  }
  const { objects } = drainObjects(agentText);
  for (const ev of objects) yield { kind: 'agent', ev };
}
