/**
 * Pages Mark is building for the search page's "+ Add company / person", as the
 * list shows them ("Generating") and as their own address shows them while they
 * are built (BuildView.tsx).
 *
 * A build is a run of a Mark workflow started through the API with a JSON
 * message (api/page-builds). Its address is fixed when it starts and handed to
 * Mark as `page_route`, so the link a rep follows while it works is the page's
 * own. This module turns a workflow execution, and the memory of the agent
 * steps inside it, into what the browser draws.
 *
 * Pure: the server summarises with it; the browser only reads the result.
 */

export type BuildKind = 'account' | 'person';
export type BuildStatus = 'waiting' | 'running' | 'done' | 'failed';

/** What the server keeps about a build (api/_lib/page-builds-store.ts). */
export type BuildRecord = {
  id: string;
  kind: BuildKind;
  /** What the list shows: the company or the person. */
  name: string;
  /** The address the page will have, without slashes: `acme` or `acme/jane-doe`. */
  route: string;
  /** Account builds: the website Mark resolves the Salesforce account from, and its domain. */
  website?: string;
  domain?: string;
  /** Person builds: the account page they hang off (its name as Mark wrote it). */
  companyName?: string;
  personTitle?: string;
  email: string;
  executionId?: string;
  /** A person build waiting for its company's account build to finish. */
  after?: string;
  startedAt: number;
  status: BuildStatus;
  /** Where the page actually landed, when Mark put it somewhere else. */
  finalRoute?: string;
  error?: string;
  finishedAt?: number;
};

export type BuildStep = {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  startedAt?: number;
  endedAt?: number;
};

export type BuildEvent = {
  seq: string;
  at: number;
  /** text: Mark narrating; thinking: its reasoning; tool: a tool call. */
  kind: 'text' | 'thinking' | 'tool';
  text: string;
  /** For tools: the tool's name, for an icon. */
  tool?: string;
};

/** One row in the list. */
export type BuildSummary = {
  id: string;
  kind: BuildKind;
  name: string;
  route: string;
  status: BuildStatus;
  statusLine: string;
  /** 0–1, from the steps done and typical step lengths. */
  progress: number;
  startedAt: number;
  finishedAt?: number;
};

/** The live view. */
export type BuildDetail = BuildSummary & {
  steps: BuildStep[];
  events: BuildEvent[];
  /** The page exists in the CMS already (Mark writes it in two halves). */
  pageWritten: boolean;
  error?: string;
};

/** Lowercase, hyphens, letters and digits only: Mark's own slug rule ("Baker McKenzie" → "baker-mckenzie"). */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

/** `www.anaplan.com/en` → `anaplan`: the name part of a website, for when no name was typed. */
export function nameFromWebsite(website: string): string {
  const host = website.toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
  const labels = host.split('.').filter(Boolean);
  // `bbc.co.uk` → `bbc`, `anaplan.com` → `anaplan`.
  const short = labels.length > 2 && labels[labels.length - 2].length <= 3 ? labels[labels.length - 3] : labels[0];
  return short || host;
}

/* ---------- The workflows' steps, as the rep reads them ---------- */

type StepPlan = { id: string; label: string; typicalSeconds: number };

/** Limitless one-off account page (ef6efcd5). Step ids are the workflow's own. */
export const ACCOUNT_STEPS: StepPlan[] = [
  { id: '1b000000-0000-4000-8000-000000000001', label: 'Finding the account in Salesforce', typicalSeconds: 30 },
  { id: '1d000000-0000-4000-8000-000000000001', label: 'Reading what we know about it', typicalSeconds: 15 },
  { id: '2b000000-0000-4000-8000-000000000002', label: 'Researching and writing the dossier', typicalSeconds: 45 },
  { id: '3b000000-0000-4000-8000-000000000003', label: 'Saving the dossier', typicalSeconds: 10 },
  { id: '4a000000-0000-4000-8000-000000000001', label: 'Building the page', typicalSeconds: 600 },
  { id: '4b000000-0000-4000-8000-000000000002', label: 'Writing the outreach email', typicalSeconds: 20 },
  { id: '4c000000-0000-4000-8000-000000000003', label: 'Messaging you on Teams', typicalSeconds: 30 },
];
/** The account workflow's error route: "Tell the requester why not". */
export const ACCOUNT_REFUSED_STEP = '4d000000-0000-4000-8000-000000000004';
const ACCOUNT_PAGE_STEP = '4a000000-0000-4000-8000-000000000001';

/** Limitless person pages for a company (186d5b6b). Its own account-page branch is never used: the account is built first. */
export const PERSON_STEPS: StepPlan[] = [
  { id: 'b1a1fdce-0865-4851-b693-aae8f4592211', label: 'Opening the company page', typicalSeconds: 10 },
  { id: 'b2000000-0000-4000-8000-000000000003', label: 'Reading the stakeholders', typicalSeconds: 10 },
  { id: 'b2000000-0000-4000-8000-000000000005', label: 'Building the person page', typicalSeconds: 190 },
  { id: 'b2000000-0000-4000-8000-000000000006', label: 'Wrapping up', typicalSeconds: 5 },
];
const PERSON_PAGE_STEP = 'b2000000-0000-4000-8000-000000000005';

export const stepPlan = (kind: BuildKind) => (kind === 'account' ? ACCOUNT_STEPS : PERSON_STEPS);
export const pageStepId = (kind: BuildKind) => (kind === 'account' ? ACCOUNT_PAGE_STEP : PERSON_PAGE_STEP);

/* ---------- Tool calls, as the rep reads them ---------- */

const hostOf = (url: unknown) => {
  try {
    return new URL(String(url)).host.replace(/^www\./, '');
  } catch {
    return String(url ?? '').replace(/^https?:\/\//, '').split('/')[0];
  }
};
const pathOf = (url: unknown) => {
  try {
    const u = new URL(String(url));
    return (u.host.replace(/^www\./, '') + u.pathname).replace(/\/$/, '');
  } catch {
    return String(url ?? '');
  }
};

/** "Reading optimizely.com/vs-drupal", "Looking up stakeholders on LinkedIn", … */
export function toolLabel(name: string, input: Record<string, unknown> = {}): string {
  switch (name) {
    case 'get_learning':
      return 'Reading the account dossier';
    case 'get_page':
      return input.existsOnly ? 'Checking for an existing page' : 'Reading the page';
    case 'list_page_templates':
      return 'Reading the page template';
    case 'browse_web': {
      const urls = Array.isArray(input.urls) ? input.urls.map((u) => (typeof u === 'object' && u ? (u as { url?: unknown }).url : u)) : [];
      if (!urls.length) return 'Browsing the web';
      const first = pathOf(urls[0]);
      return urls.length > 1 ? `Reading ${first} and ${urls.length - 1} more` : `Reading ${first}`;
    }
    case 'search_web': {
      const q = String(input.search_query ?? input.query ?? '');
      return /linkedin\.com/i.test(q) ? 'Looking up stakeholders on LinkedIn' : `Searching “${q.slice(0, 60)}”`;
    }
    case 'take_webpage_screenshot':
      return `Taking a screenshot of ${hostOf(input.url)}`;
    case 'write_file_to_library':
      return 'Uploading the screenshot';
    case 'create_page':
      return 'Creating the page';
    case 'update_page':
      return 'Writing the page';
    default:
      return name.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  }
}

/* ---------- From Mark's records to what the browser draws ---------- */

/** The bits of a workflow execution read here (GET /workflow-executions/{id}). */
export type MarkStepExecution = {
  step_id: string;
  status: string;
  start_time?: string | null;
  end_time?: string | null;
  agent_execution_id?: string | null;
  result?: { response?: unknown } | null;
  error_message?: string | null;
  children?: MarkStepExecution[] | null;
};
export type MarkExecution = {
  id: string;
  status: string;
  start_time?: string | null;
  end_time?: string | null;
  error_message?: string | null;
  step_executions?: MarkStepExecution[];
};
/** A memory chunk (GET /memories/{id}/chunks). */
export type MarkChunk = {
  id: string;
  type: string;
  created_at: string;
  sequence_number?: number;
  content: unknown;
};

/* Hypatia's times carry no zone and are UTC. */
const utc = (t?: string | null) => (t ? Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(t) ? t : `${t}Z`) : undefined);

const isDone = (s: string) => /^(completed|success|succeeded)$/i.test(s);
const isFailed = (s: string) => /^(failed|error|cancelled|canceled|timed_out|timeout)$/i.test(s);

/** Every step execution, loop children included. */
export function flattenSteps(steps: MarkStepExecution[] = []): MarkStepExecution[] {
  return steps.flatMap((s) => [s, ...flattenSteps(s.children ?? [])]);
}

/** The page's address in a finished page step's answer, without slashes. */
export function routeFromResponse(response: unknown): string | null {
  const text = typeof response === 'string' ? response : JSON.stringify(response ?? '');
  const slug = /SLUG:\s*([a-z0-9-]+(?:\/[a-z0-9-]+)?)/i.exec(text);
  if (slug) return slug[1].toLowerCase();
  const link = /showcase\.optimizely\.com\/([a-z0-9-]+(?:\/[a-z0-9-]+)?)/i.exec(text);
  return link ? link[1].toLowerCase() : null;
}

export function stepsFor(kind: BuildKind, execution: MarkExecution | null): BuildStep[] {
  const ran = new Map(flattenSteps(execution?.step_executions).map((s) => [s.step_id, s]));
  const finished = execution ? isDone(execution.status) || isFailed(execution.status) : false;
  return stepPlan(kind).map((plan) => {
    const s = ran.get(plan.id);
    const status: BuildStep['status'] = !s
      ? finished
        ? 'skipped'
        : 'pending'
      : isDone(s.status)
        ? 'done'
        : isFailed(s.status)
          ? 'failed'
          : 'running';
    return { id: plan.id, label: plan.label, status, startedAt: utc(s?.start_time), endedAt: utc(s?.end_time) };
  });
}

/** Done steps count in full; the running one by its share of a typical run, never past 95%. */
export function progressOf(kind: BuildKind, steps: BuildStep[], now = Date.now()): number {
  const plan = stepPlan(kind);
  const total = plan.reduce((sum, p) => sum + p.typicalSeconds, 0);
  let done = 0;
  steps.forEach((s, i) => {
    const typical = plan[i].typicalSeconds;
    if (s.status === 'done' || s.status === 'skipped') done += typical;
    else if (s.status === 'running' && s.startedAt) done += Math.min(0.95, (now - s.startedAt) / 1000 / typical) * typical;
  });
  return Math.max(0.02, Math.min(0.99, done / total));
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/** Mark's narration, reasoning and tool calls, oldest first, trimmed for the browser. */
export function eventsFrom(chunks: MarkChunk[]): BuildEvent[] {
  const events: BuildEvent[] = [];
  for (const c of chunks) {
    const at = utc(c.created_at) ?? 0;
    const content = (c.content ?? {}) as Record<string, unknown>;
    if (c.type === 'text' && typeof content.text === 'string' && content.text.trim()) {
      events.push({ seq: c.id, at, kind: 'text', text: clip(content.text.trim(), 600) });
    } else if (c.type === 'thinking' && typeof content.thinking === 'string' && content.thinking.trim()) {
      events.push({ seq: c.id, at, kind: 'thinking', text: clip(content.thinking.trim(), 900) });
    } else if (c.type === 'tool_use' && typeof content.name === 'string') {
      const input = (content.input ?? {}) as Record<string, unknown>;
      events.push({ seq: c.id, at, kind: 'tool', tool: content.name, text: toolLabel(content.name, input) });
    }
  }
  return events.sort((a, b) => a.at - b.at || a.seq.localeCompare(b.seq));
}

/** True once a create_page or update_page call in the page step came back successful. */
export function pageWrittenIn(chunks: MarkChunk[]): boolean {
  const writes = new Set<string>();
  for (const c of chunks) {
    const content = (c.content ?? {}) as Record<string, unknown>;
    if (c.type === 'tool_use' && (content.name === 'create_page' || content.name === 'update_page')) {
      writes.add(String(content.execution_id));
    }
    if (c.type === 'tool_result' && writes.has(String(content.execution_id))) {
      const inner = (content.content ?? {}) as { success?: boolean; result?: unknown };
      if (inner.success && !/"success"\s*:\s*false/.test(String(inner.result ?? ''))) return true;
    }
  }
  return false;
}

/** The one line under the name in the list. */
export function statusLineOf(record: BuildRecord, steps: BuildStep[], events: BuildEvent[]): string {
  if (record.status === 'waiting') return 'Waiting for the company page…';
  if (record.status === 'done') return 'Ready';
  if (record.status === 'failed') return record.error ? clip(record.error, 90) : 'Mark could not build this page';
  const running = steps.find((s) => s.status === 'running');
  if (!running) return steps.some((s) => s.status === 'done') ? 'Working…' : 'Starting…';
  // In the long page step, the latest tool says more than the step's name.
  const last = [...events].reverse().find((e) => e.kind === 'tool' && e.at >= (running.startedAt ?? 0));
  return last ? `${last.text}…` : `${running.label}…`;
}
