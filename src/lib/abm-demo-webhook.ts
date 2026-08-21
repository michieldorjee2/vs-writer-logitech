/**
 * Fire-and-forget webhook fired when a visitor clicks the demo / "Get in
 * touch" button (sticky bar or bottom CTA) on an ABM page. It posts the
 * three dedicated-team people to the Opal ingest webhook so a workflow can
 * pick up the lead. Nothing is rendered to the user — the call happens
 * silently and in parallel with the existing warp-modal animation.
 *
 * Cross-origin note: we deliberately avoid a CORS preflight. `sendBeacon`
 * (and the `no-cors` fetch fallback) issue a "simple" POST that the browser
 * never blocks, so the request reaches Opal even though we can't read the
 * (opaque) response. That's fine — this is fire-and-forget.
 */

import type { CompetitorComparisonPage } from './graph-types';
import { getPageSlug, deriveCustomerName } from './page-identity';

const WEBHOOK_URL =
  'https://webhook.opal.optimizely.com/webhooks/4f42a24e93f945bcb262bff01a9a1562/4520324a-9e6d-43df-93c1-d70d6a9c3dc1';

/** Positional labels for the dedicated Optimizely team, in render order. */
const TEAM_LABELS = ['account executive', 'technical lead', 'account lead'] as const;

interface TeamMember {
  Initials: string;
  Name: string;
  Role: string;
  Email: string | null;
}

function buildPayload(page: CompetitorComparisonPage, source: string) {
  const team: Record<string, { name: string; role: string; email: string | null; initials: string }> = {};
  (page.teamMembers || []).slice(0, TEAM_LABELS.length).forEach((m: TeamMember, i) => {
    team[TEAM_LABELS[i]] = {
      name: m.Name,
      role: m.Role,
      email: m.Email,
      initials: m.Initials,
    };
  });

  return {
    event: 'demo_button_clicked',
    source, // which button: 'sticky-connect-btn' | 'cta-connect-btn'
    timestamp: new Date().toISOString(),
    page: {
      slug: getPageSlug(page),
      url: typeof window !== 'undefined' ? window.location.href : null,
      customer: deriveCustomerName(page),
    },
    team,
  };
}

/**
 * POST the team payload to the Opal webhook. Tries `sendBeacon` first
 * (most reliable for fire-and-forget, survives navigation), then falls
 * back to a `no-cors` keepalive fetch. Never throws.
 */
export function fireDemoWebhook(page: CompetitorComparisonPage, source: string): void {
  if (typeof window === 'undefined') return;
  try {
    const body = JSON.stringify(buildPayload(page, source));

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      // text/plain keeps it a "simple" request — no CORS preflight.
      const blob = new Blob([body], { type: 'text/plain;charset=UTF-8' });
      if (navigator.sendBeacon(WEBHOOK_URL, blob)) return;
    }

    void fetch(WEBHOOK_URL, {
      method: 'POST',
      mode: 'no-cors',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body,
    }).catch(() => {
      /* fire-and-forget — ignore network errors */
    });
  } catch {
    /* never let the webhook break the click handler */
  }
}
