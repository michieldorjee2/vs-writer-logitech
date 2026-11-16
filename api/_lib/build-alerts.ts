/**
 * An email when a page build fails, so a failure is seen the same hour instead of when a rep
 * mentions it in Teams (the IKEA person page on 16 Nov failed for every rep for three days,
 * because the CMS retired the API Mark's page tools called, and nobody was told).
 *
 * Sent from the OPAL_PAT owner's own Outlook, through Mark's `outlook_mail_send` called
 * directly on the tools service: no agent, no credits, one request. The client type must be
 * `mcp`: with `web` the tool only stages a review card and sends nothing (ok:true,
 * submitted:false).
 *
 * To whom: BUILD_ALERT_EMAIL (comma-separated) when it is set, and nobody when it is `off`.
 * Unset, production mails the PAT's owner (its `sub` claim: whoever's key builds the pages
 * owns the builds), so no address has to be kept in config; previews and local runs mail
 * nobody.
 *
 * At most one email per build (a `pb:alerted:<id>` key, kept as long as the build), however
 * many browsers or sweeps see it fail. Never throws: an alert that cannot be sent is logged,
 * and the request it rode on carries on.
 */
import type { BuildKind } from '../../src/lib/page-builds.js';
import { INSTANCE_ID } from './mark.js';
import type { BuildStore } from './page-builds-store.js';

const TOOLS_URL = (process.env.OPAL_BASE_URL || 'https://opal.optimizely.com').replace(/\/+$/, '') + '/tools-mgmt-service/api';
const KEEP_SECONDS = 3 * 24 * 60 * 60;
const SEND_TIMEOUT_MS = 10_000;

export type BuildAlert = {
  /** What was asked for, as the subject names it: "Cecilia Jeppsson at IKEA", "acme.com". */
  what: string;
  /** Who asked. */
  email: string;
  /** Where it failed: starting it, Mark's run, the company page a person waited for, or running far too long. */
  stage: 'start' | 'run' | 'waiting' | 'stalled';
  /** Why, in the words of whatever said so. */
  reason: string;
  kind?: BuildKind;
  buildId?: string;
  route?: string;
  executionId?: string;
  startedAt?: number;
};

const STAGE: Record<BuildAlert['stage'], string> = {
  start: 'could not be started',
  run: 'finished without a page',
  waiting: 'was not started: its company page failed',
  stalled: 'has been running for over an hour',
};

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The email, for the send and for scripts/check-page-builds.ts. */
export function alertEmail(alert: BuildAlert): { subject: string; html: string } {
  const subject = `Showcase build ${alert.stage === 'stalled' ? 'stalled' : 'failed'}: ${alert.what}`;
  const rows: [string, string][] = [
    ['What', `${alert.kind === 'person' ? 'Person page' : alert.kind === 'account' ? 'Account page' : 'Page'}: ${alert.what}`],
    ['Requested by', alert.email],
    ['Reason', alert.reason || '(none given)'],
  ];
  if (alert.route) rows.push(['Address', `https://showcase.optimizely.com/${alert.route}`]);
  if (alert.executionId) rows.push(['Mark run', alert.executionId]);
  if (alert.startedAt) rows.push(['Started', new Date(alert.startedAt).toISOString().replace('T', ' ').slice(0, 16) + ' UTC']);
  const table = rows
    .map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#666;vertical-align:top">${escapeHtml(k)}</td><td style="padding:2px 0">${escapeHtml(v)}</td></tr>`)
    .join('');
  const open = alert.route
    ? `<p>Open <a href="https://showcase.optimizely.com/${escapeHtml(alert.route)}">showcase.optimizely.com/${escapeHtml(alert.route)}</a> (signed in) to see what Mark did.</p>`
    : '';
  const html = `<p>A Showcase page build ${STAGE[alert.stage]}.</p><table style="border-collapse:collapse;font-size:14px">${table}</table>${open}`;
  return { subject, html };
}

type PatClaims = { sub?: string; instance?: { hosted_region?: string } };
function claimsOf(pat: string): PatClaims {
  try {
    return JSON.parse(Buffer.from(pat.split('.')[1] ?? '', 'base64url').toString()) as PatClaims;
  } catch {
    return {};
  }
}

/** The PAT's hosting region (its claims carry it), for the tools service's x-opal-region. */
const regionOf = (pat: string) => String(claimsOf(pat).instance?.hosted_region || 'US').toUpperCase();

/** Who gets the alerts: BUILD_ALERT_EMAIL, or in production the PAT's owner; [] for nobody. */
export function alertRecipients(pat: string): string[] {
  const configured = process.env.BUILD_ALERT_EMAIL?.trim();
  if (configured) return configured.toLowerCase() === 'off' ? [] : configured.split(',').map((a) => a.trim()).filter(Boolean);
  if (process.env.VERCEL_ENV !== 'production') return [];
  const owner = claimsOf(pat).sub?.trim();
  return owner && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(owner) ? [owner] : [];
}

/** Emails the alert; 'skipped' when not configured or already sent for this build. */
export async function alertBuildFailed(alert: BuildAlert, store?: BuildStore | null): Promise<'sent' | 'skipped' | 'failed'> {
  const pat = process.env.OPAL_PAT?.trim();
  if (!pat) return 'skipped';
  const to = alertRecipients(pat);
  if (!to.length) return 'skipped';
  const onceKey = alert.buildId && store ? `pb:alerted:${alert.stage === 'stalled' ? 'stall:' : ''}${alert.buildId}` : null;
  // A send that fails gives the key back, so the next look at the build tries again.
  const release = async () => {
    if (onceKey && store) await store.del(onceKey).catch(() => {});
  };
  try {
    if (onceKey && store) {
      const first = await store.set(onceKey, 1, { nx: true, ex: KEEP_SECONDS });
      if (!first) return 'skipped';
    }
    const { subject, html } = alertEmail(alert);
    const recipients = JSON.stringify(to.map((address) => ({ emailAddress: { address } })));
    const r = await fetch(`${TOOLS_URL}/tools/organizations/${INSTANCE_ID}/tools/invoke`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pat}`,
        'x-instance-id': INSTANCE_ID,
        'x-opal-client-type': 'mcp',
        'x-opal-region': regionOf(pat),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        tool_name: 'outlook_mail_send',
        timeout: 8,
        parameters: { subject, bodyContent: html, bodyContentType: 'HTML', toRecipients: recipients, importance: 'high' },
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    const text = await r.text();
    // The tools service answers 200 even when the tool failed: read the envelope.
    const body = (() => {
      try {
        return JSON.parse(text) as { response_type?: string; response?: { success?: boolean; error?: string; submitted?: boolean } | string };
      } catch {
        return null;
      }
    })();
    const response = body?.response;
    const failed =
      !r.ok ||
      !body ||
      body.response_type === 'error' ||
      body.response_type === 'auth_required' ||
      (typeof response === 'object' && response !== null && (response.success === false || response.submitted === false || Boolean(response.error)));
    if (failed) {
      console.error('[build-alerts] not sent', r.status, text.slice(0, 300));
      await release();
      return 'failed';
    }
    console.log('[build-alerts] sent', subject);
    return 'sent';
  } catch (err) {
    console.error('[build-alerts] not sent', err);
    await release();
    return 'failed';
  }
}
