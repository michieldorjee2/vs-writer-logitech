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
 *     their note when there is one); answers { to, subject, body, by }. A template when Mark is
 *     unavailable or slow, so the rep always gets a draft to open in Outlook.
 *
 * The page's title and summary come from the page the rep is on (they only shape a message to
 * the rep, or a draft the rep reads before sending). 30 Teams messages and 40 drafts a day each.
 */
import { createHash, randomUUID } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireIdentity, type Identity } from './_lib/auth.js';
import { canonicalJson } from './cta-ping.js';
import { MarkError, markConfigured, runAgent } from './_lib/mark.js';
import { activityStore, cached } from './_lib/page-activity-store.js';
import { isJson, jsonBody, linkOrigin, sameSite } from './_lib/share-http.js';
import { getLink, SHARE_LIMITS_PER, shareStore, statsOf, underLimit, type ShareStore } from './_lib/share-store.js';
import { channelName, factsOf, type ActivityResponse } from '../src/lib/page-activity.js';
import { firstNameOf, nameFromEmail, noteText, oneLine, shareCodeOf, sharePathOf, shareUrl, type ShareLink, type ShareStats } from '../src/lib/share-links.js';

export const config = { maxDuration: 60 };

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

/** Mark's answer as a draft: a JSON object with a subject and a body, the link in the body. */
export function parseDraft(text: string, to: string, url: string): EmailDraft | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const j = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    const subject = oneLine(j.subject, 200);
    let body = noteText(j.body, 3000);
    if (!subject || !body) return null;
    if (!body.includes(url)) body = `${body}\n\n${url}`;
    return { to, subject, body, by: 'mark' };
  } catch {
    return null;
  }
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

let override: { store?: ShareStore | null; post?: typeof fetch; agent?: typeof runAgent } = {};
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
    const fallback = templateDraft({ to, recipientName: link?.recipient.name ?? '', account: title, message: link?.message ?? '', url, sender: identity.name || nameFromEmail(who) });
    const agentId = EMAIL_AGENT_ID();
    if (!agentId || (!override.agent && !markConfigured())) return res.status(200).json(fallback);
    try {
      const text = await (override.agent ?? runAgent)(
        agentId,
        {
          recipient_name: link?.recipient.name ?? '',
          recipient_title: link?.recipient.title ?? '',
          personal_message: link?.message ?? '',
          page_title: title,
          page_summary: summary,
          page_kind: route.person ? 'person' : 'account',
          page_url: url,
          sender_name: identity.name || nameFromEmail(who),
        },
        25_000,
      );
      return res.status(200).json(parseDraft(text, to, url) ?? fallback);
    } catch (error) {
      console.warn('[share-send] Mark wrote no draft:', error instanceof MarkError || error instanceof Error ? error.message : 'error');
      return res.status(200).json(fallback);
    }
  } catch (error) {
    console.error(`[share-send] ${channel} failed:`, error instanceof Error ? error.message : 'error');
    return res.status(502).json({ error: channel === 'teams' ? 'Mark didn’t take the message. Try again' : 'Could not write the email' });
  }
}
