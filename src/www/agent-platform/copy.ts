/**
 * The agent platform page's copy, key by key: the template's text for this page (from its state,
 * its lead themes, its stack), with the page's own copy on top (src/lib/page-copy.ts). The page
 * renders from this, and Edit mode sends Mark the text each part shows now.
 */
import { COPY_KEYS, themeKeys, type PageCopy } from '../../lib/page-copy'
import type { AgentPlatformContent } from './content'
import { FIRST_90_DAYS, GOVERNANCE_LINE, IDENTITY_SENTENCE, STATES, THEMES, USE_CASES_CLOSING_LINE, WHO_WE_ARE, type ThemeId } from './library'

export function fill(s: string, c: AgentPlatformContent, lead?: ThemeId) {
  return s.replaceAll('{account}', c.account).replaceAll('{lead}', lead ? THEMES[lead].lead : '')
}

/** "CMS, customer data and marketing automation": the stack the Connect step names. */
export function stackPhrase(c: AgentPlatformContent): string {
  // "customer data", "marketing automation", but "CMS" and "ABM" stay capitals.
  const word = (cat: string) => (cat === cat.toUpperCase() ? cat : cat.toLowerCase())
  const cats = [...new Set(c.stack.value.filter((t) => !t.ours && t.category !== 'Tool').map((t) => word(t.category)))].slice(0, 3)
  return cats.length ? cats.join(cats.length > 2 ? ', ' : ' and ').replace(/, ([^,]*)$/, ' and $1') : 'the tools you already run'
}

/** The template's text for every editable part of this page. */
export function templateCopy(c: AgentPlatformContent): Required<Record<string, string | string[]>> {
  const st = STATES[c.state.value]
  const [lead, second] = c.themes.value
  const customer = c.state.value === 'customer'
  const trackB = st.proofTrack === 'B'
  const out: Record<string, string | string[]> = {
    'hero.h1': st.h1,
    'hero.sub': `${IDENTITY_SENTENCE} ${fill(st.sub, c, lead)}`,
    'who.heading': WHO_WE_ARE.heading,
    'fit.heading': 'Keep your stack. Add the layer that ##connects it##.',
    'fit.lead': 'Each tool does one job well. Agents read across all of them and act.',
    'language.heading': `Generic AI guesses. Ours starts from how ${c.account} works.`,
    'language.question': c.question.value,
    'language.generic': 'Paste in your campaign data and I\'ll summarize it for you.',
    'language.checks': THEMES[lead].checks,
    'usecases.heading': `Same platform. A starting point only ${c.account} would pick.`,
    'usecases.closing': USE_CASES_CLOSING_LINE,
    'proof.heading': trackB ? 'Teams with many audiences are already ##running agents##.' : 'Where agent platforms are heading.',
    'ninety.heading': customer ? 'Your next 90 days' : 'Your first 90 days',
    'ninety.governance': GOVERNANCE_LINE,
    'close.heading': fill(st.closeHeading, c),
    'close.reason1': THEMES[lead].reason,
    'close.reason2': THEMES[second].reason,
    'close.reason3': `It runs on the stack ${c.account} already has. Nothing gets replaced.`,
    'close.line': st.closeLine,
  }
  WHO_WE_ARE.tiles.forEach((t, i) => {
    out[`who.tile${i + 1}.title`] = t.title
    out[`who.tile${i + 1}.body`] = t.body
  })
  const phrase = stackPhrase(c)
  FIRST_90_DAYS.forEach((s, i) => {
    out[`ninety.step${i + 1}.title`] = s.step
    out[`ninety.step${i + 1}.body`] = s.body.replace('{stack}', phrase)
  })
  // The two lead themes are cards (title, text), the next three the strip under them: only the
  // keys the page shows, so Edit mode offers what a reader can see.
  c.themes.value.slice(0, 5).forEach((id, i) => {
    const t = THEMES[id]
    const [title, body, stripTitle, stripBody] = themeKeys(id)
    if (i < 2) {
      out[title] = c.jobs.value[id] ?? t.job
      out[body] = t.body
    } else {
      out[stripTitle] = t.strip.title
      out[stripBody] = t.strip.body
    }
  })
  return out as Required<Record<string, string | string[]>>
}

/** The page's copy: its own text where it has some, the template's everywhere else. */
export function resolveCopy(c: AgentPlatformContent, own: PageCopy | null | undefined): Record<string, string | string[]> {
  const base = templateCopy(c)
  if (!own) return base
  const out = { ...base }
  for (const [k, v] of Object.entries(own)) if (k in base && (typeof v === 'string' ? v : v.length)) out[k] = v
  return out
}

/** Every fixed key the template has (the use-case keys follow the page's themes). */
export const FIXED_COPY_KEYS = COPY_KEYS
