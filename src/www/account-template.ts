/**
 * Which account page a stored page renders: what the page sells decides, never the URL (Michiel,
 * 4 Nov: "it should be dynamic based on what we're selling … I don't want toggles in the url").
 *
 * Every stored page is written the same way (a competitor, a comparison, a challenge, a path, a
 * return), but what it leads with is the builder's pitch for that account: a CMS takeout
 * ("Relief for RINA S.p.A."), testing ("Prove every Lenovo launch"), Limitless itself ("Limitless
 * for Google Cloud"), or the agent platform ("Marketing agents for Smartsheet, Inc."). So:
 *
 *   agent-platform  the page pitches the agent platform: its headline names agents, or its headline
 *                   or subheadline names the Agent Platform. Laura's template (./AgentPlatformPage),
 *                   built for exactly that pitch.
 *   takeout         anything else: the page's own pitch, every stored field, in the new design
 *                   (./AccountPage).
 *
 * The same answer on the server render, the client, the CMS preview and Edit mode, so hydration
 * holds and every tool sees the page a reader sees.
 */
import type { CompetitorComparisonPage } from '../lib/graph-types'

export type AccountTemplate = 'agent-platform' | 'takeout'

const text = (s: string | null | undefined) => (s ?? '').replace(/<[^>]+>/g, ' ').replace(/##/g, '')

export function accountTemplateOf(page: Pick<CompetitorComparisonPage, 'headline' | 'subheadline'>): AccountTemplate {
  const headline = text(page.headline)
  if (/\bagents?\b|\bagent platform\b/i.test(headline)) return 'agent-platform'
  if (/\bagent platform\b/i.test(text(page.subheadline))) return 'agent-platform'
  return 'takeout'
}
