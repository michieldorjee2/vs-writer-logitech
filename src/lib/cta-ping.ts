/**
 * The Limitless one-click ask: a visitor clicked "talk to your team" on an account page
 * (src/www/ConnectModal.tsx). The browser says only which page and which button, to the site's
 * own server; api/cta-ping.ts looks the page's team up itself, limits how often a page can ping,
 * and hands the click to Mark's "Showcase CTA ping" workflow, which messages the account
 * executive in Teams or adds a row to the follow-up sheet (mark/cta-ping/README.md).
 *
 * The Mark webhook and its key live on the server only: the browser never sees them, so nobody
 * can message a rep from outside the page. Fire-and-forget: the panel opens whatever happens, and
 * nothing is sent from the CMS preview (an editor previewing a draft is not a visitor).
 */
import { inCmsPreview } from './cms-preview.js'
import { utmOf } from './offer-signup.js'

export const CTA_PING_ENDPOINT = '/api/cta-ping'

/** The buttons that can ask, by their element id (the server refuses any other). */
export const CTA_SOURCES = ['hero-connect-btn', 'cta-connect-btn', 'sticky-connect-btn'] as const
export type CtaSource = (typeof CTA_SOURCES)[number]

type Where = Pick<Location, 'pathname' | 'search'>

/** POST the click to the site's own server. Never throws. */
export function sendCtaPing(source: CtaSource, location: Where | null = typeof window !== 'undefined' ? window.location : null): void {
  if (!location || inCmsPreview(location)) return
  try {
    const body = JSON.stringify({ route: location.pathname, source, utm: utmOf(location.search) })
    // keepalive: the ping survives the visitor following the panel's "Schedule a call" link at once.
    void fetch(CTA_PING_ENDPOINT, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body }).catch(() => {
      /* fire-and-forget */
    })
  } catch {
    /* never let the ping break the click */
  }
}
