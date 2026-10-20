/**
 * The few Mark (Opal Hypatia) API calls the page builds need, as plain fetches
 * (the same way api/opal-edit-stream.ts calls it). Runs as the OPAL_PAT's
 * owner, like the workflows' webhooks always have; the rep is a parameter.
 *
 * Env: OPAL_PAT (required), OPAL_BASE_URL, OPAL_INSTANCE_ID.
 */
import type { MarkChunk, MarkExecution } from '../../src/lib/page-builds.js';

const BASE_URL = (process.env.OPAL_BASE_URL || 'https://opal.optimizely.com').replace(/\/+$/, '');
const INSTANCE_ID = process.env.OPAL_INSTANCE_ID || '4f42a24e93f945bcb262bff01a9a1562';

/** Limitless one-off account page (showcase search). */
export const ACCOUNT_WORKFLOW_ID = process.env.MARK_ACCOUNT_WORKFLOW_ID || 'ef6efcd5-a814-4ad5-befe-66e730fcdf59';
/** Limitless person pages for a company. */
export const PERSON_WORKFLOW_ID = process.env.MARK_PERSON_WORKFLOW_ID || '186d5b6b-7bc1-4230-b7ee-c594248782af';

export class MarkError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const markConfigured = () => Boolean(process.env.OPAL_PAT);

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const pat = process.env.OPAL_PAT;
  if (!pat) throw new MarkError('OPAL_PAT is not set', 503);
  const res = await fetch(`${BASE_URL}/hypatia/api/v1/${INSTANCE_ID}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${pat}`, Accept: 'application/json', ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    throw new MarkError(`Mark ${init.method ?? 'GET'} ${path.split('?')[0]} → ${res.status} ${detail}`, res.status);
  }
  return (await res.json()) as T;
}

const unwrap = <T>(body: unknown): T => ((body as { data?: T })?.data ?? body) as T;

/**
 * Starts a workflow run with a JSON message (the workflow's message trigger;
 * its steps read the fields by name). Returns the execution id.
 */
export async function startWorkflow(workflowId: string, message: Record<string, unknown>): Promise<string> {
  const body = await call<unknown>(`/agents/workflows/${workflowId}/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(message),
  });
  const execution = unwrap<{ id?: string; workflow_execution_id?: string }>(body);
  const id = execution?.id ?? execution?.workflow_execution_id;
  if (!id) throw new MarkError('Mark started no run', 502);
  return id;
}

export async function getExecution(id: string): Promise<MarkExecution> {
  return unwrap<MarkExecution>(await call(`/workflow-executions/${id}`));
}

/** An agent step's own record: where its memory (narration, tool calls) is. */
export async function getAgentMemoryId(agentExecutionId: string): Promise<string | null> {
  const execution = unwrap<{ memory_id?: string | null }>(await call(`/agents/specialized/executions/${agentExecutionId}`));
  return execution?.memory_id ?? null;
}

/** What the agent has written so far: thinking, text, tool calls and results. */
export async function getMemoryChunks(memoryId: string): Promise<MarkChunk[]> {
  const body = await call<unknown>(`/memories/${memoryId}/chunks?page_size=500`);
  const list = Array.isArray(body) ? body : ((body as { items?: unknown[]; data?: unknown[] }).items ?? (body as { data?: unknown[] }).data ?? []);
  return list as MarkChunk[];
}

/* ---------- Specialized agents (the search page's offer looks) ---------- */

/** Makes an offer's look for the search page (src/lib/offer-looks.ts). */
export const LOOK_AGENT_ID = process.env.MARK_LOOK_AGENT_ID || '7b9f7a28-736d-44fc-9663-7c47ebf9c421';

/** A specialized agent's run record (GET /agents/specialized/executions/{id}). */
export type MarkAgentExecution = {
  id: string;
  status?: string;
  status_code?: string;
  memory_id?: string | null;
  /** `{ response: "<text>" }` (a JSON-output agent's JSON arrives as that string), or `{ error }`. */
  result?: { response?: string; error?: string } | string | null;
  error_message?: string | null;
};

/** Starts an agent run in the background (it can outlive any one request). Returns its id. */
export async function startAgent(agentId: string, parameters: Record<string, unknown>): Promise<string> {
  const body = await call<unknown>(`/agents/specialized/${agentId}/execute?run_in_background=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parameters }),
  });
  const id = unwrap<{ id?: string }>(body)?.id;
  if (!id) throw new MarkError('Mark started no run', 502);
  return id;
}

export async function getAgentExecution(id: string): Promise<MarkAgentExecution> {
  return unwrap<MarkAgentExecution>(await call(`/agents/specialized/executions/${id}`));
}

/** A file Mark made (a generated image): its links answer only with the PAT. */
export const isMarkFile = (url: string) => /^https:\/\/opal-backend\.optimizely\.com\/v1\/file\/[\w-]+$/.test(url);
export function markFileHeaders(): Record<string, string> {
  const pat = process.env.OPAL_PAT;
  return pat ? { Authorization: `Bearer ${pat}` } : {};
}
