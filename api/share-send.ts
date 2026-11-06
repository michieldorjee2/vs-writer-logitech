/**
 * POST /api/share-send { channel, route, code?, title, summary? }: the Share sheet's two ways out
 * (src/components/ShareSheet.tsx). Signed-in Optimizely people only.
 *
 *   channel "teams": Mark's "Showcase share to Teams" workflow (mark/share-teams/) messages the
 *     signed-in person, and only them, the page's link (their personal link when `code` is one of
 *     this page's) with what the page has seen: visits, last seen, CTA clicks, stage, and the
 *     link's opens. Off unless SHARE_TEAMS_WEBHOOK_URL and SHARE_TEAMS_WEBHOOK_KEY are set.
 *     `check` is the SHA-256 of the rest as canonical JSON, recomputed by the workflow.
 *   channel "email": Mark's "Showcase share email" agent writes the email (to the recipient, from
 *     their note when there is one; without a link, to `recipient`, the person a person page is
 *     for), streamed through the official Agent SDK so the card shows it being written. Answers
 *     server-sent events: { k: "text", t } as Mark writes, then { k: "done", draft: { to, subject,
 *     body, by } }. The draft is a template when Mark is unavailable or slow, so the rep always
 *     gets one to open in Outlook.
 *
 * The page's title and summary come from the page the rep is on (they only shape a message to
 * the rep, or a draft the rep reads before sending). 30 Teams messages and 40 drafts a day each.
 */
import { createHash, randomUUID } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireIdentity, type Identity } from './_lib/auth.js';
import { canonicalJson } from './cta-ping.js';
import { MarkError, markConfigured, streamAgentText } from './_lib/mark.js';
import { activityStore, cached } from './_lib/page-activity-store.js';
import { isJson, jsonBody, linkOrigin, sameSite } from './_lib/share-http.js';
import { getLink, SHARE_LIMITS_PER, shareStore, statsOf, underLimit, type ShareStore } from './_lib/share-store.js';
import { channelName, factsOf, type ActivityResponse } from '../src/lib/page-activity.js';
import { firstNameOf, nameFromEmail, noteText, oneLine, shareCodeOf, sharePathOf, shareUrl, splitDraft, type ShareLink, type ShareStats } from '../src/lib/share-links.js';

export const config = { maxDuration: 60 };
/** Mark gets this long to write the email before the card gets the template. */
const EMAIL_TIMEOUT_MS = 30_000;

const WEBHOOK_HOSTS = new Set(['webhook.mark.optimizely.com', 'webhook.opal.optimizely.com']);
/** Mark's "Showcase share email" agent (showcase_share_email): no tools, about two seconds and two credits a draft. */
const EMAIL_AGENT_ID = () => process.env.SHARE_EMAIL_AGENT_ID?.trim() || '73f146bc-a052-4d5f-be22-06fc36f010cd';

export interface ShareTeamsPing {
  event: 'share_teams';
  ping_id: string;
  requested_at: string;
  /** The signed-in person: the only one this ever messages. */
  to: { name: string; email: string };
  page: { url: string; title: string; person: boolean };
  link: { url: string; recipient: string; message: string; opens: number; last_open: string; ctas: number } | null;
  analytics: { visits: number; visitors: number; last_seen: string; cta_clicks: number; stage: string; last_channel: string } | null;
  check: string;
}

export interface EmailDraft {
  to: string;
  subject: string;
  body: string;
  by: 'mark' | 'template';
}

/** "6 Nov 2026" (UTC), or empty. */
export function dayOf(ts: number | null | undefined): string {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export const teamsCheckOf = (ping: Omit<ShareTeamsPing, 'check'>): string => createHash('sha256').update(canonicalJson(ping), 'utf8').digest('hex');

export function buildShareTeams(input: {
  to: Identity;
  pageUrl: string;
  title: string;
  person: boolean;
  link: (ShareLink & { url: string; stats: ShareStats }) | null;
  report: ActivityResponse | null;
  now?: Date;
  pingId?: string;
}): ShareTeamsPing {
  const { link, report } = input;
  const facts = report ? factsOf(report.report.visitors) : null;
  const body: Omit<ShareTeamsPing, 'check'> = {
    event: 'share_teams',
    ping_id: input.pingId ?? randomUUID(),
    requested_at: (input.now ?? new Date()).toISOString(),
    to: { name: oneLine(input.to.name, 120) || nameFromEmail(input.to.email), email: input.to.email.toLowerCase() },
    page: { url: input.pageUrl, title: oneLine(input.title, 160) || 'the Showcase page', person: input.person },
    link: link
      ? {
          url: link.url,
          recipient: [link.recipient.name, link.recipient.title].filter(Boolean).join(', '),
          message: noteText(link.message, 1200),
          opens: link.stats.opens,
          last_open: dayOf(link.stats.lastOpen),
          ctas: link.stats.ctas,
        }
      : null,
    analytics:
      report && facts
        ? {
            visits: report.report.visitors.visits,
            visitors: report.report.visitors.visitors,
            last_seen: dayOf(facts.lastSeen),
            cta_clicks: facts.ctaClicks,
            stage: oneLine(report.account?.stage ?? '', 60),
            last_channel: oneLine(channelName(facts.lastChannel) ?? '', 60),
          }
        : null,
  };
  return { ...body, check: teamsCheckOf(body) };
}

/** A draft from the template: what the rep gets when Mark can't write one. */
export function templateDraft(input: { to: string; recipientName: string; account: string; message: string; url: string; sender: string }): EmailDraft {
  const first = firstNameOf(input.recipientName);
  const account = input.account || 'you';
  const body = [
    first ? `Hi ${first},` : 'Hi,',
    '',
    input.message || `We put together a page for ${account}: how teams like yours are using Optimizely, and where we think we could help.`,
    '',
    input.url,
    '',
    'Best,',
    firstNameOf(input.sender) || input.sender,
  ].join('\n');
  return { to: input.to, subject: first ? `${first}, a page we made for ${account}` : `A page we made for ${account}`, body, by: 'template' };
}

/** Mark's answer as a draft ("Subject: …", a blank line, the body), the link in the body. */
export function parseDraft(text: string, to: string, url: string): EmailDraft | null {
  const { subject: s, body: b } = splitDraft(text);
  const subject = oneLine(s, 200);
  let body = noteText(b, 3000);
  if (!subject || !body) return null;
  if (!body.includes(url)) body = `${body}\n\n${url}`;
  return { to, subject, body, by: 'mark' };
}

function webhook(): { url: string; key: string } | null {
  const url = process.env.SHARE_TEAMS_WEBHOOK_URL?.trim();
  const key = process.env.SHARE_TEAMS_WEBHOOK_KEY?.trim();
  if (!url || !key) return null;
  try {
    const u = new URL(url);
    if (u.protocol === 'https:' && WEBHOOK_HOSTS.has(u.hostname)) return { url, key };
  } catch {
    /* falls through */
  }
  console.error('[share-send] SHARE_TEAMS_WEBHOOK_URL is not a Mark webhook: nothing sent');
  return null;
}

let override: { store?: ShareStore | null; post?: typeof fetch; agent?: typeof streamAgentText } = {};
/** For the checks: stand-ins for Redis, the webhook post and Mark. */
export function setShareSendSources(o: typeof override): void {
  override = o;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const identity = requireIdentity(req, res);
  if (!identity) return;
  if (!isJson(req)) return res.status(415).json({ error: 'JSON only' });
  if (!sameSite(req)) return res.status(403).json({ error: 'Not from this site' });
  const body = jsonBody(req, 4096);
  const channel = body?.channel === 'teams' || body?.channel === 'email' ? body.channel : null;
  const route = sharePathOf(typeof body?.route === 'string' ? body.route.slice(0, 420) : '');
  if (!body || !channel || !route) return res.status(400).json({ error: 'Bad request' });
  const title = oneLine(body.title, 160);
  const summary = oneLine(body.summary, 400);
  // Without a personal link, who the page itself is for (a person page's person), for the draft only.
  const hint = (body.recipient && typeof body.recipient === 'object' ? body.recipient : {}) as Record<string, unknown>;
  const code = body.code == null ? null : shareCodeOf(body.code);
  if (body.code != null && !code) return res.status(400).json({ error: 'Bad request' });

  const store = 'store' in override ? override.store : shareStore();
  if (!store) return res.status(503).json({ error: 'Sharing is not configured here' });
  const origin = linkOrigin(req);
  const pageUrl = `${origin}/${route.path}/`;
  const now = Math.floor(Date.now() / 1000);
  const who = identity.email.toLowerCase();

  try {
    let link: (ShareLink & { url: string; stats: ShareStats }) | null = null;
    if (code) {
      const found = await getLink(store, code);
      if (!found || found.path !== route.path) return res.status(404).json({ error: 'That link isn’t on this page' });
      link = { ...found, url: shareUrl(origin, code), stats: await statsOf(store, code) };
    }

    if (channel === 'teams') {
      const hook = webhook();
      if (!hook) return res.status(503).json({ error: 'Send on Teams isn’t set up here' });
      if (!(await underLimit(store, 'teams', who, SHARE_LIMITS_PER.teamsDay, 'day', now))) return res.status(429).json({ error: 'That’s a lot of messages for one day' });
      // The Report's last build, when the rail asked for one in the last five minutes (account pages).
      const activity = route.person ? null : activityStore();
      const report = activity ? await cached<ActivityResponse>(activity, `pa:r2:${route.path}:all`).catch(() => null) : null;
      const ping = buildShareTeams({ to: identity, pageUrl, title, person: route.person, link, report });
      const r = await (override.post ?? fetch)(hook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-showcase-key': hook.key },
        body: JSON.stringify(ping),
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) throw new Error(`Mark answered ${r.status}`);
      console.info(`[share-send] /${route.path}/ ${ping.ping_id}: handed to Mark for Teams`);
      return res.status(202).json({ ok: true });
    }

    if (!(await underLimit(store, 'email', who, SHARE_LIMITS_PER.emailDay, 'day', now))) return res.status(429).json({ error: 'That’s a lot of drafts for one day' });
    const to = link?.recipient.email ?? '';
    const url = link?.url ?? pageUrl;
    const recipientName = link?.recipient.name ?? oneLine(hint.name, 120);
    const recipientTitle = link?.recipient.title ?? oneLine(hint.title, 120);
    const fallback = templateDraft({ to, recipientName, account: title, message: link?.message ?? '', url, sender: identity.name || nameFromEmail(who) });
    const agentId = EMAIL_AGENT_ID();

    // From here the answer is a stream: Mark's words as they come, then the draft.
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.status(200);
    const send = (msg: Record<string, unknown>) => res.write(`data: ${JSON.stringify(msg)}\n\n`);
    if (!agentId || (!override.agent && !markConfigured())) {
      send({ k: 'done', draft: fallback });
      return res.end();
    }
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), EMAIL_TIMEOUT_MS);
    // The rep closed the card (or the tab): stop Mark. Not req's close, which can fire once the body is read.
    res.on?.('close', () => ac.abort());
    let text = '';
    try {
      const words = (override.agent ?? streamAgentText)(
        agentId,
        {
          recipient_name: recipientName,
          recipient_title: recipientTitle,
          personal_message: link?.message ?? '',
          page_title: title,
          page_summary: summary,
          page_kind: route.person ? 'person' : 'account',
          page_url: url,
          sender_name: identity.name || nameFromEmail(who),
        },
        ac.signal,
      );
      for await (const t of words) {
        text += t;
        send({ k: 'text', t });
      }
      const draft = parseDraft(text, to, url);
      if (!draft) console.warn("[share-send] Mark's answer was not a draft: the template instead");
      send({ k: 'done', draft: draft ?? fallback });
    } catch (error) {
      console.warn('[share-send] Mark wrote no draft:', error instanceof MarkError || error instanceof Error ? error.message : 'error');
      send({ k: 'done', draft: fallback });
    } finally {
      clearTimeout(timer);
      res.end();
    }
    return;
  } catch (error) {
    console.error(`[share-send] ${channel} failed:`, error instanceof Error ? error.message : 'error');
    return res.status(502).json({ error: channel === 'teams' ? 'Mark didn’t take the message. Try again' : 'Could not write the email' });
  }
}
