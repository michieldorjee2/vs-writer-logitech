/**
 * Page builds, server side: start them through Mark's API, follow them, and
 * hand the browser a summary (the list) or the detail (the page's own address
 * while it is built). Shared by api/page-builds/*, the SSR handler and the
 * Vite dev server.
 */
import { randomBytes } from 'node:crypto';
import {
  eventsFrom,
  flattenSteps,
  pageStepId,
  pageWrittenIn,
  progressOf,
  routeFromResponse,
  slugify,
  statusLineOf,
  stepsFor,
  ACCOUNT_REFUSED_STEP,
  type BuildDetail,
  type BuildRecord,
  type BuildSummary,
  type MarkChunk,
  type MarkExecution,
} from '../../src/lib/page-builds.js';
import { ACCOUNT_WORKFLOW_ID, PERSON_WORKFLOW_ID, getAgentMemoryId, getExecution, getMemoryChunks, startWorkflow } from './mark.js';
import { addBuild, routeTaken, saveBuild, getBuild, type BuildStore } from './page-builds-store.js';

const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2';

/* Several browsers poll the same build; Mark's records are 100–150 KB, so each
   is fetched at most every few seconds per instance. */
const CACHE_MS = 4000;
const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, load: () => Promise<T>, ms = CACHE_MS): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ms) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 200) cache.delete(cache.keys().next().value as string);
  return value;
}

const newId = () => randomBytes(9).toString('base64url');

/** Whether the CMS already has a page at this address. */
export async function pageExists(route: string): Promise<boolean> {
  const authKey = process.env.GRAPH_AUTH_KEY;
  if (!authKey) return false;
  const r = await fetch(`${GRAPH_ENDPOINT}?auth=${authKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: PAGE_AT_ROUTE_QUERY, variables: { url: `/${route}/` } }),
  });
  const body = (await r.json()) as { data?: { _Content?: { total?: number } } };
  return (body.data?._Content?.total ?? 0) > 0;
}

export const PAGE_AT_ROUTE_QUERY = `
query PageAtRoute($url: String!) {
  _Content(where: { _metadata: { url: { hierarchical: { eq: $url } } } }, limit: 1) {
    total
  }
}
`;

/** `acme`, or `acme-2` when `acme` is a page already or another build's address. */
export async function freeRoute(store: BuildStore, base: string, parent = ''): Promise<string> {
  const prefix = parent ? `${parent}/` : '';
  for (let n = 1; n < 20; n++) {
    const route = `${prefix}${n === 1 ? base : `${base}-${n}`}`;
    if (!(await routeTaken(store, route)) && !(await pageExists(route))) return route;
  }
  return `${prefix}${base}-${newId().slice(0, 4).toLowerCase()}`;
}

/* ---------- Starting ---------- */

export async function startAccountBuild(
  store: BuildStore,
  input: { website: string; domain: string; name: string; email: string },
): Promise<BuildRecord> {
  const route = await freeRoute(store, slugify(input.name) || 'company');
  const record: BuildRecord = {
    id: newId(),
    kind: 'account',
    name: input.name,
    route,
    website: input.website,
    domain: input.domain,
    email: input.email,
    startedAt: Date.now(),
    status: 'running',
  };
  record.executionId = await startWorkflow(ACCOUNT_WORKFLOW_ID, {
    company_name: input.website,
    edit_user_email: input.email,
    page_route: route,
    requested_at: new Date().toISOString(),
  });
  await addBuild(store, record);
  return record;
}

export async function startPersonBuild(
  store: BuildStore,
  input: { personName: string; personTitle?: string; companyName: string; companyRoute: string; email: string; after?: string },
): Promise<BuildRecord> {
  const route = await freeRoute(store, slugify(input.personName) || 'person', input.companyRoute);
  const record: BuildRecord = {
    id: newId(),
    kind: 'person',
    name: input.personName,
    route,
    companyName: input.companyName,
    personTitle: input.personTitle,
    email: input.email,
    startedAt: Date.now(),
    status: input.after ? 'waiting' : 'running',
    after: input.after,
  };
  if (!input.after) record.executionId = await runPerson(record);
  await addBuild(store, record);
  return record;
}

function runPerson(record: BuildRecord): Promise<string> {
  return startWorkflow(PERSON_WORKFLOW_ID, {
    target_company: record.companyName,
    person_name: record.name,
    // Left out rather than sent empty: the agent checks the title itself when none is given.
    ...(record.personTitle ? { person_title: record.personTitle } : {}),
    optimizely_email: record.email,
    requested_at: new Date().toISOString(),
  });
}

/* ---------- Following ---------- */

const isDone = (s: string) => /^(completed|success|succeeded)$/i.test(s);
const isFailed = (s: string) => /^(failed|error|cancelled|canceled|timed_out|timeout)$/i.test(s);
const responseText = (r: unknown) => (typeof r === 'string' ? r : r == null ? '' : JSON.stringify(r));

/** The company name Mark resolved, from the account build's "Stamp, vet and commit" step. */
function resolvedCompanyName(execution: MarkExecution): string | null {
  for (const s of flattenSteps(execution.step_executions)) {
    const rv = (s as { output_data?: { return_value?: { results?: { companyName?: string }[] } } }).output_data?.return_value;
    const name = rv?.results?.[0]?.companyName;
    if (name) return name;
  }
  return null;
}

/** Reads the build's run and moves the record on: done, failed, or (a waiting person build) started. */
export async function refreshBuild(store: BuildStore, record: BuildRecord): Promise<{ record: BuildRecord; execution: MarkExecution | null }> {
  if (record.status === 'waiting' && record.after) {
    const parent = await getBuild(store, record.after);
    if (parent && parent.status !== 'done' && parent.status !== 'failed') await refreshBuild(store, parent);
    const settled = parent ? await getBuild(store, parent.id) : null;
    if (!settled || settled.status === 'failed') {
      record = { ...record, status: 'failed', error: `The ${settled?.name ?? 'company'} page could not be built, so this one was not started.`, finishedAt: Date.now() };
      await saveBuild(store, record);
    } else if (settled.status === 'done') {
      // Several browsers poll; only the first to see the company finish starts the person.
      const first = await store.set(`pb:starting:${record.id}`, 1, { nx: true, ex: 600 });
      if (!first) return { record: (await getBuild(store, record.id)) ?? record, execution: null };
      const companyRoute = settled.finalRoute ?? settled.route;
      const route = record.route.startsWith(`${companyRoute}/`) ? record.route : `${companyRoute}/${record.route.split('/').pop()}`;
      record = { ...record, route, companyName: settled.companyName ?? settled.name, status: 'running', startedAt: Date.now() };
      record.executionId = await runPerson(record);
      await saveBuild(store, record);
    }
    return { record, execution: null };
  }
  if (!record.executionId) return { record, execution: null };

  const execution = await cached(`ex:${record.executionId}`, () => getExecution(record.executionId as string));
  if (record.status === 'running' && (isDone(execution.status) || isFailed(execution.status))) {
    const steps = flattenSteps(execution.step_executions);
    const page = steps.find((s) => s.step_id === pageStepId(record.kind));
    const refused = steps.find((s) => s.step_id === ACCOUNT_REFUSED_STEP);
    const landed = page && isDone(page.status) ? routeFromResponse(page.result?.response) : null;
    if (landed) {
      record = {
        ...record,
        status: 'done',
        finishedAt: Date.now(),
        ...(landed !== record.route ? { finalRoute: landed } : {}),
        ...(record.kind === 'account' ? { companyName: resolvedCompanyName(execution) ?? record.name } : {}),
      };
    } else {
      const why = refused ? responseText(refused.result?.response) : execution.error_message || page?.error_message || '';
      record = {
        ...record,
        status: 'failed',
        finishedAt: Date.now(),
        error: firstSentence(why) || 'Mark finished without building the page.',
      };
    }
    await saveBuild(store, record);
  }
  return { record, execution };
}

function firstSentence(text: string): string {
  const plain = text.replace(/[`*_#>]/g, '').replace(/\s+/g, ' ').trim();
  const m = /^(.{12,200}?[.!?])(\s|$)/.exec(plain);
  return (m ? m[1] : plain.slice(0, 200)).trim();
}

/** Every chunk the run's agent steps have written so far, oldest first. */
async function chunksOf(execution: MarkExecution | null, kind: BuildRecord['kind']): Promise<{ all: MarkChunk[]; page: MarkChunk[] }> {
  if (!execution) return { all: [], page: [] };
  const agentSteps = flattenSteps(execution.step_executions).filter((s) => s.agent_execution_id);
  const per = await Promise.all(
    agentSteps.map(async (s) => {
      const done = isDone(s.status) || isFailed(s.status);
      // A finished step's memory does not change: keep it longer.
      const memoryId = await cached(`mem:${s.agent_execution_id}`, () => getAgentMemoryId(s.agent_execution_id as string), 600_000);
      if (!memoryId) return { step: s.step_id, chunks: [] as MarkChunk[] };
      const chunks = await cached(`chunks:${memoryId}`, () => getMemoryChunks(memoryId), done ? 600_000 : CACHE_MS);
      return { step: s.step_id, chunks };
    }),
  );
  // The page step is the one that writes the page (for a person build it sits inside the loop).
  return { all: per.flatMap((p) => p.chunks), page: per.filter((p) => p.step === pageStepId(kind)).flatMap((p) => p.chunks) };
}

export function summarize(record: BuildRecord, execution: MarkExecution | null, events: BuildDetail['events'] = []): BuildSummary {
  const steps = stepsFor(record.kind, execution);
  return {
    id: record.id,
    kind: record.kind,
    name: record.name,
    route: record.finalRoute ?? record.route,
    status: record.status,
    statusLine: statusLineOf(record, steps, events),
    progress: record.status === 'done' ? 1 : record.status === 'waiting' ? 0.02 : progressOf(record.kind, steps),
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
  };
}

/** For the list: the latest tool call is worth one memory read for running builds. */
export async function summaryOf(store: BuildStore, record: BuildRecord): Promise<BuildSummary> {
  const { record: fresh, execution } = await refreshBuild(store, record);
  if (fresh.status !== 'running') return summarize(fresh, execution);
  const { all } = await chunksOf(execution, fresh.kind);
  return summarize(fresh, execution, eventsFrom(all));
}

export async function detailOf(store: BuildStore, record: BuildRecord): Promise<BuildDetail> {
  const { record: fresh, execution } = await refreshBuild(store, record);
  const { all, page } = await chunksOf(execution, fresh.kind);
  const events = eventsFrom(all);
  return {
    ...summarize(fresh, execution, events),
    steps: stepsFor(fresh.kind, execution),
    events,
    pageWritten: fresh.status === 'done' || pageWrittenIn(page),
    error: fresh.error,
  };
}
