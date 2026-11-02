/**
 * Reads an offer page's Visual Builder composition back into the offer blueprint's named
 * content (offerHeadline, agendaSteps, faqs, …) so the www-design offer page can lay it out
 * with optimizely.com components instead of the blueprint's grid.
 *
 * How it finds things: a section's displayName names its slot (the blueprint writes it), and
 * within a slot the blueprint emits its feeds IN ORDER, one row per feed, so walking the
 * slot's elements and matching each to the next feed of the same content type reconstructs
 * the flat keys exactly. `OFFER_SLOTS` mirrors src/cms/blueprints/offer.ts and
 * scripts/check-www-coverage.tsx fails if the two ever disagree.
 *
 * Nothing is dropped: an element no feed claims lands in its section's `extras`, and a
 * section that matches no slot comes back as `unknown`, and the page renders both.
 */

export type ElementData = { __typename: string } & Record<string, unknown>

export interface FeedSpec {
  key: string
  type: string
  many?: boolean
}

export interface SlotSpec {
  id: string
  names: string[] // the blueprint's displayName first, then names older pages were written with
  feeds: FeedSpec[]
}

export const OFFER_SLOTS: SlotSpec[] = [
  {
    id: 'hero',
    names: ['Hero'],
    feeds: [
      { key: 'offerEyebrow', type: 'StackedHeadingElement' },
      { key: 'offerHeadline', type: 'StackedHeadingElement' },
      { key: 'offerHighlights', type: 'StatBlock', many: true },
      { key: 'offerIntro', type: 'TextContentElement' },
      { key: 'offerCta', type: 'ButtonBlock' },
      { key: 'offerSecondaryCta', type: 'ButtonBlock' },
    ],
  },
  {
    id: 'offer-about',
    names: ['Who is Optimizely?'],
    feeds: [
      { key: 'aboutEyebrow', type: 'StackedHeadingElement' },
      { key: 'aboutHeadline', type: 'StackedHeadingElement' },
      { key: 'aboutIntro', type: 'TextContentElement' },
      { key: 'aboutPillars', type: 'AbmFrictionPointElement', many: true },
    ],
  },
  {
    id: 'offer-problem',
    names: ['The opportunity, and how it works', 'The problem'],
    feeds: [
      { key: 'problemThesis', type: 'AbmThesisElement' },
      { key: 'problemLanes', type: 'AbmUseCaseLaneElement', many: true },
    ],
  },
  {
    id: 'customer-stories',
    names: ['Proof'],
    feeds: [
      { key: 'proofHeadline', type: 'StackedHeadingElement' },
      { key: 'proofQuote1', type: 'CardCustomerQuoteBlock' },
      { key: 'proofQuote2', type: 'CardCustomerQuoteBlock' },
    ],
  },
  {
    id: 'offer-hosts',
    names: ['Who runs it'],
    feeds: [
      { key: 'hostsHeadline', type: 'StackedHeadingElement' },
      { key: 'hostsIntro', type: 'TextContentElement' },
      { key: 'hosts', type: 'AbmTeamMemberElement', many: true },
    ],
  },
  {
    id: 'offer-outcomes',
    names: ['What you walk away with'],
    feeds: [
      { key: 'outcomesHeadline', type: 'StackedHeadingElement' },
      { key: 'outcomesIntro', type: 'TextContentElement' },
      { key: 'outcomes', type: 'AbmFrictionPointElement', many: true },
    ],
  },
  {
    id: 'offer-agenda',
    names: ['How it runs'],
    feeds: [
      { key: 'agendaHeadline', type: 'StackedHeadingElement' },
      { key: 'agendaIntro', type: 'TextContentElement' },
      { key: 'agendaSteps', type: 'AbmTimelinePhaseElement', many: true },
    ],
  },
  {
    id: 'offer-fit',
    names: ['What this means for you', 'Is this for you?'],
    feeds: [
      { key: 'fitHeadline', type: 'StackedHeadingElement' },
      { key: 'fitYes', type: 'CalloutBlock' },
      { key: 'fitNo', type: 'CalloutBlock' },
    ],
  },
  {
    id: 'offer-faq',
    names: ['Questions'],
    feeds: [
      { key: 'faqHeadline', type: 'StackedHeadingElement' },
      { key: 'faqs', type: 'FaqItemElement', many: true },
    ],
  },
  {
    id: 'contact-close',
    names: ['Sign up'],
    feeds: [{ key: 'offerClose', type: 'AbmClosingCtaElement' }],
  },
]

export interface OfferSection {
  slot: string | null // null = a section no slot claims
  name: string
  anchor: string | null
  values: Record<string, ElementData | ElementData[]>
  extras: ElementData[]
}

type Node = {
  nodeType?: string
  displayName?: string
  displaySettings?: Array<{ key: string; value: string }>
  rows?: Array<{ columns?: Array<{ elements?: Array<{ component?: ElementData }> }> }>
  nodes?: Node[]
}

function elementsOf(section: Node): ElementData[] {
  const out: ElementData[] = []
  for (const r of section.rows ?? []) for (const c of r.columns ?? []) for (const e of c.elements ?? []) {
    if (e.component?.__typename) out.push(e.component)
  }
  return out
}

export function readOffer(experience: { composition?: Node | null }): OfferSection[] {
  const sections = experience.composition?.nodes ?? []
  return sections.map((s) => {
    const name = s.displayName ?? ''
    const anchor = s.displaySettings?.find((d) => d.key === 'anchor')?.value ?? null
    const spec = OFFER_SLOTS.find((x) => x.names.includes(name)) ?? null
    const elements = elementsOf(s)
    const values: OfferSection['values'] = {}
    const extras: ElementData[] = []
    if (!spec) return { slot: null, name, anchor, values, extras: elements }
    let f = 0
    for (const el of elements) {
      // Advance past feeds that cannot take this element (a feed the writer left empty).
      // An eyebrow is the h4 kicker: a page that left it out starts with its h1/h2 headline,
      // which must not be read as the eyebrow.
      const isTitle = el.__typename === 'StackedHeadingElement' && /^h[12]$/.test(String(el.HeadingLevel ?? ''))
      let i = f
      while (
        i < spec.feeds.length &&
        (spec.feeds[i].type !== el.__typename || (isTitle && spec.feeds[i].key.endsWith('Eyebrow')))
      )
        i++
      if (i >= spec.feeds.length) {
        extras.push(el)
        continue
      }
      const feed = spec.feeds[i]
      if (feed.many) {
        ;((values[feed.key] ??= []) as ElementData[]).push(el)
        f = i // a many-feed keeps taking its type
      } else {
        values[feed.key] = el
        f = i + 1
      }
    }
    return { slot: spec.id, name, anchor, values, extras }
  })
}

/** Typed field read: `str(el, 'Text')`. */
export function str(el: ElementData | ElementData[] | undefined, field: string): string {
  if (!el || Array.isArray(el)) return ''
  const v = el[field]
  return typeof v === 'string' ? v : ''
}

export function list(v: ElementData | ElementData[] | undefined): ElementData[] {
  return Array.isArray(v) ? v : v ? [v] : []
}
