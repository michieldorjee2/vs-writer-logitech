/**
 * Tests for the www-design pages (src/www). Run with:
 *
 *   npm run check:www
 *
 * No network, no credentials, no test runner: scripts/check-www.mjs bundles this file with
 * esbuild (it is TSX importing TSX and the vendored optimizely.com components) and runs it with
 * node. Same convention as check:render.
 *
 * What it proves:
 *   1. the pure helpers (stat formatting, the comparison table, heading conversion, the
 *      ?design=www switch, offer detection)
 *   2. readOffer() reads a Visual Builder composition back into the offer blueprint's keys,
 *      including pages that leave a feed out, legacy section names, unknown sections
 *   3. OFFER_SLOTS is the offer blueprint (src/cms/blueprints/offer.ts), feed for feed
 *   4. NOTHING IS LOST: an account page with all 67 properties filled renders every stored
 *      value, and an offer page renders every string of every element in its composition
 *   5. X-ray and Edit mode can find every section: each ABM_XRAY_DEFAULTS id has a
 *      `data-xray` hook on the new page and every selector matches it
 *   6. the agent platform template (the default www account page): the adapter that re-reads
 *      existing pages into it, Laura's rules (N1 to N14, gate 2), the lifecycle states, and that
 *      every stored field is either used or deliberately not shown
 */
import assert from 'node:assert/strict'
import { renderToString } from 'react-dom/server'
import type { CompetitorComparisonPage } from '../../lib/graph-types'
import AccountPage, { connectProps } from '../AccountPage'
import OfferPage from '../OfferPage'
import { ACCOUNT_FIELDS } from '../account-fields'
import { comparisonTableHtml, formatStatValue, PROOF_LOGOS, realContacts } from '../account-helpers'
import { isOfferExperience, wantsWwwDesign } from '../design'
import { OFFER_SLOTS, readOffer, type ElementData } from '../offer-content'
import { plain, richToStacked } from '../ui'
import { ABM_XRAY_DEFAULTS, ABM_XRAY_LEGACY_IDS, AGENT_PLATFORM_EDIT, AGENT_PLATFORM_XRAY } from '../../lib/xray-defaults'
import { buildSuggestedEdit, AGENT_PLATFORM_TEMPLATE_LINE } from '../../lib/edit-payload'
import { applyLiveField, changedLiveFields, LIVE_FIELDS, liveValue, mergeLive, resetLive } from '../live-edit'
import AgentPlatformPage from '../AgentPlatformPage'
import offerBlueprint from '../../cms/blueprints/offer'
import WwwAccountRoute from '../WwwAccountRoute'
import { agentPlatformHead, competitorMatcher, deriveState, fromLegacyPage, NOT_SHOWN, personMatcher, USED_FIELDS } from '../agent-platform/content'
import { readStack, stackTiles } from '../agent-platform/stack'
import { DEFAULT_TEAMS, IDENTITY_SENTENCE, THEME_ORDER } from '../agent-platform/library'

/* ------------------------------------------------------------------ harness */

let passed = 0
const failures: string[] = []
function test(name: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log(`  ok  ${name}`)
  } catch (err) {
    failures.push(name)
    console.log(`  FAIL ${name}\n       ${(err as Error).message.split('\n').join('\n       ')}`)
  }
}

/** Visible text of server-rendered HTML: tags dropped, entities decoded, whitespace collapsed. */
function textOf(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, ' ')
}

/* ------------------------------------------------------------------ fixtures */

/**
 * Every one of the content type's 67 properties set, each to a value found nowhere else,
 * so "it is on the page" can only mean "this field put it there". Synthetic on purpose: no
 * real account, person or address is committed to the repo.
 */
function fullAccountPage(): CompetitorComparisonPage & Record<string, unknown> {
  return {
    __typename: 'CompetitorComparisonPage',
    _metadata: { key: 'k-test', url: { default: '/acme-corp/', hierarchical: '/en/acme-corp/' }, published: '2026-11-01T00:00:00Z' },
    PageTitle: 'F-PageTitle',
    MetaDescription: 'F-MetaDescription',
    salesforceAccountID: '001000000000000AAA',
    eyebrow: 'F-eyebrow',
    headline: 'F-headline for Acme',
    subheadline: 'F-subheadline',
    cta: 'F-cta',
    link: { default: 'https://example.test/F-link' },
    comparisonHeadline: 'F-comparisonHeadline',
    comparisonTableRows: [
      { Category: 'F-row-1', OurValue: 'Yes', CompetitorValue: 'Limited' },
      { Category: 'F-row-2', OurValue: 'F-free-text-ours', CompetitorValue: 'No' },
      { Category: 'F-row-3', OurValue: 'Yes', CompetitorValue: 'F-free-text-theirs' },
    ],
    analystHeadline: 'F-analystHeadline',
    analystQuote: 'F-analystQuote',
    analystSource: 'F-analystSource',
    analystCTA: 'F-analystCTA',
    analystCTALink: { default: 'https://example.test/F-analystCTALink' },
    promoEyebrow: 'F-promoEyebrow',
    promoHeading: 'F-promoHeading',
    promoDescription: 'F-promoDescription',
    promoCTA: 'F-promoCTA',
    promoCTALink: { default: 'https://example.test/F-promoCTALink' },
    endHeadline: 'F-endHeadline',
    endSubheadline: 'F-endSubheadline',
    endCTA: 'F-endCTA',
    endCTALink: { default: 'https://example.test/F-endCTALink' },
    testimonial1: 'F-testimonial1',
    testimonial1JobTitle: 'F-testimonial1JobTitle',
    testimonial1Company: 'F-testimonial1Company',
    testimonial2: 'F-testimonial2',
    testimonial2JobTitle: 'F-testimonial2JobTitle',
    testimonial2Company: 'F-testimonial2Company',
    Logos: null,
    customerLogo: 'https://example.test/F-customerLogo.png',
    brandDomain: 'f-branddomain.test',
    brandAccentColor: '#0a1b2c',
    intelEyebrow: 'F-intelEyebrow',
    intelHeadline: 'We know <em>F-intelHeadline</em>',
    competitorName: 'F-competitorName',
    challengeHeadline: 'You are on <span class="text--highlight">F-challengeHeadline.</span><br>We hear you.',
    challengeScreenshotUrl: { default: 'https://example.test/F-challengeScreenshotUrl.png' },
    challengeScreenshotAlt: 'F-challengeScreenshotAlt',
    challengeBrowserUrl: 'F-challengeBrowserUrl',
    comparisonDescription: 'F-comparisonDescription',
    logoWallCustomerSlot: 'F-logoWallCustomerSlot',
    roiTitle: 'F-roiTitle',
    roiDescription: 'F-roiDescription',
    roiProjectionValue: 'F-roiProjectionValue',
    roiProjectionLabel: 'F-roiProjectionLabel',
    roiProjectionDetail: 'F-roiProjectionDetail',
    migrationTitle: 'F-migrationTitle',
    migrationDescription: 'F-migrationDescription',
    stickyCTAText: 'F-stickyCTAText',
    ctaTitle: 'F-ctaTitle',
    ctaDescription: 'F-ctaDescription',
    ctaButtonText: 'F-ctaButtonText',
    modalScheduleUrl: { default: 'https://example.test/F-modalScheduleUrl' },
    footerTagline: 'F-footerTagline',
    footerLegal: 'F-footerLegal',
    intelStats: [
      { Value: 'F-stat-1', Label: 'F-stat-label-1' },
      { Value: 'F-stat-2', Label: 'F-stat-label-2' },
    ],
    stakeholders: [
      {
        Initials: 'FS',
        Name: 'F-stakeholder-name',
        Role: 'F-stakeholder-role',
        LinkedInUrl: { default: 'https://example.test/F-stakeholder-linkedin' },
        AvatarColor: null,
        EngagementTier: 'engaged',
        EngagementNote: 'F-stakeholder-note',
        PersonSlug: 'f-person-slug',
        CrmContactId: null,
      },
    ],
    techStack: [
      { Name: 'F-tool-competitor', ColorTag: 'var(--orange)' },
      { Name: 'F-tool-2', ColorTag: 'var(--green)' },
    ],
    investments: [
      { Name: 'F-investment-1', IsPrimary: true },
      { Name: 'F-investment-2', IsPrimary: false },
    ],
    newsItems: [
      { Date: 'F-news-date', Headline: 'F-news-headline', Url: { default: 'https://example.test/F-news-url' } },
      { Date: 'F-news-date-2', Headline: 'F-news-headline-2', Url: null },
    ],
    painPoints: [
      { Title: 'F-pain-1', Description: 'F-pain-desc-1' },
      { Title: 'F-pain-2', Description: 'F-pain-desc-2' },
      { Title: 'F-pain-3', Description: 'F-pain-desc-3' },
    ],
    roiCards: [
      { Metric: 'F-metric-1', Unit: 'F-unit-1', Label: 'F-roi-label-1', CitationText: 'F-citation-1, https://example.test/F-citation-url' },
      { Metric: 'F-metric-2', Unit: 'F-unit-2', Label: 'F-roi-label-2', CitationText: 'F-citation-2' },
    ],
    timelinePhases: [
      { Title: 'F-phase-1', Description: 'F-phase-desc-1', MarkerColor: null },
      { Title: 'F-phase-2', Description: 'F-phase-desc-2', MarkerColor: null },
      { Title: 'F-phase-3', Description: 'F-phase-desc-3', MarkerColor: null },
    ],
    teamMembers: [
      { Initials: 'FT', Name: 'F-team-name', Role: 'F-team-role', Email: 'f-team@example.test' },
      { Initials: 'SA', Name: 'Solutions Architect', Role: 'placeholder', Email: null },
    ],
    footerLinks: [{ Text: 'F-footer-link', Url: { default: 'https://example.test/F-footer-url' } }],
    analystCards: [
      { Badge: 'F-badge', Source: 'F-analyst-card-source', Category: 'F-analyst-category', Url: { default: 'https://example.test/F-analyst-card-url' } },
    ],
  } as unknown as CompetitorComparisonPage & Record<string, unknown>
}

const el = (__typename: string, fields: Record<string, unknown>): { nodeType: string; component: ElementData } => ({
  nodeType: 'component',
  component: { __typename, ...fields } as ElementData,
})
const section = (displayName: string, elements: Array<ReturnType<typeof el>>, anchor?: string) => ({
  nodeType: 'section',
  displayName,
  displaySettings: anchor ? [{ key: 'anchor', value: anchor }] : [],
  // one row per element, like the blueprint writes them
  rows: elements.map((e) => ({ columns: [{ elements: [e] }] })),
})

/** An offer page using every slot of the offer blueprint, plus things no slot claims. */
function fullOffer() {
  return {
    companyName: 'Acme Corp',
    customerLogo: 'https://example.test/O-logo.png',
    template: 'offer',
    composition: {
      nodeType: 'experience',
      nodes: [
        section('Hero', [
          el('StackedHeadingElement', { Text: 'O-eyebrow', HeadingLevel: 'h4' }),
          el('StackedHeadingElement', { Text: 'O-headline ##O-run##', HeadingLevel: 'h1' }),
          el('StatBlock', { StatValue: 'O-hl-1', Description: 'O-hl-desc-1' }),
          el('StatBlock', { StatValue: 'O-hl-2', Description: 'O-hl-desc-2' }),
          el('TextContentElement', { MainBody: 'O-intro-p1\n\nO-intro-p2' }),
          el('ButtonBlock', { ButtonText: 'O-cta', ButtonUrl: 'https://example.test/O-cta', Variant: 'primary' }),
          el('ButtonBlock', { ButtonText: 'O-cta-2', ButtonUrl: '#about', Variant: 'secondary' }),
        ]),
        section('Who is Optimizely?', [
          el('StackedHeadingElement', { Text: 'O-about-eyebrow', HeadingLevel: 'h4' }),
          el('StackedHeadingElement', { Text: 'O-about-headline', HeadingLevel: 'h2' }),
          el('TextContentElement', { MainBody: 'O-about-intro' }),
          el('AbmFrictionPointElement', { Title: 'O-pillar-1', Description: 'O-pillar-desc-1' }),
          el('AbmFrictionPointElement', { Title: 'O-pillar-2', Description: 'O-pillar-desc-2' }),
        ], 'about'),
        section('The problem', [
          el('AbmThesisElement', { Headline: 'O-thesis', Body: 'O-thesis-body', Quote: 'O-thesis-quote', Attribution: 'O-thesis-who' }),
          el('AbmUseCaseLaneElement', { Lane: 'O-lane-1', Need: 'O-need-1', Outcome: 'O-outcome-1', Solution: 'O-solution-1' }),
          el('AbmUseCaseLaneElement', { Lane: 'O-lane-2', Need: 'O-need-2', Outcome: 'O-outcome-2' }),
        ]),
        section('Proof', [
          el('StackedHeadingElement', { Text: 'O-proof-headline', HeadingLevel: 'h2' }),
          el('CardCustomerQuoteBlock', { QuoteText: 'O-quote-1', Attribution: 'O-who-1', CompanyName: 'O-co-1', ResourceUrl: 'https://example.test/O-story-1' }),
          el('CardCustomerQuoteBlock', { QuoteText: 'O-quote-2', Attribution: 'O-who-2', CompanyName: 'O-co-2' }),
        ]),
        section('Who runs it', [
          el('StackedHeadingElement', { Text: 'O-hosts-headline', HeadingLevel: 'h2' }),
          el('TextContentElement', { MainBody: 'O-hosts-intro' }),
          el('AbmTeamMemberElement', { Initials: 'OH', Name: 'O-host-1', Role: 'O-host-role-1', Email: 'o-host@example.test' }),
        ]),
        section('What you walk away with', [
          el('StackedHeadingElement', { Text: 'O-outcomes-headline', HeadingLevel: 'h2' }),
          el('TextContentElement', { MainBody: 'O-outcomes-intro' }),
          el('AbmFrictionPointElement', { Title: 'O-deliverable-1', Description: 'O-deliverable-desc-1' }),
        ]),
        section('How it runs', [
          el('StackedHeadingElement', { Text: 'O-agenda-headline', HeadingLevel: 'h2' }),
          el('TextContentElement', { MainBody: 'O-agenda-intro' }),
          el('AbmTimelinePhaseElement', { Title: 'O-step-1', Description: 'O-step-desc-1', MarkerColor: null }),
          el('AbmTimelinePhaseElement', { Title: 'O-step-2', Description: 'O-step-desc-2', MarkerColor: null }),
        ]),
        section('Is this for you?', [
          el('StackedHeadingElement', { Text: 'O-fit-headline', HeadingLevel: 'h2' }),
          el('CalloutBlock', { CalloutType: 'warning', CalloutHeading: 'O-fit-yes', CalloutText: '✓ O-fit-yes-1\n✓ O-fit-yes-2' }),
          el('CalloutBlock', { CalloutType: 'info', CalloutHeading: 'O-fit-no', CalloutText: '→ O-fit-no-1' }),
        ]),
        section('Questions', [
          el('StackedHeadingElement', { Text: 'O-faq-headline', HeadingLevel: 'h2' }),
          el('FaqItemElement', { Question: 'O-q-1', Answer: 'O-a-1' }),
          el('FaqItemElement', { Question: 'O-q-2', Answer: 'O-a-2' }),
          // No feed takes a ButtonBlock in this slot: it must still render.
          el('ButtonBlock', { ButtonText: 'O-extra-button', ButtonUrl: 'https://example.test/O-extra' }),
        ]),
        section('Sign up', [
          el('AbmClosingCtaElement', { Title: 'O-close-title', Description: 'O-close-desc', ButtonText: 'O-close-button', ScheduleUrl: 'https://example.test/O-close-url' }),
        ]),
        // A section no slot knows.
        section('O-unknown-section', [el('AbmFrictionPointElement', { Title: 'O-orphan-title', Description: 'O-orphan-desc' })]),
      ],
    },
  }
}

/** Every string an offer composition holds, i.e. everything that must be on the page. */
function compositionStrings(offer: ReturnType<typeof fullOffer>): string[] {
  const out: string[] = []
  for (const s of offer.composition.nodes)
    for (const r of s.rows)
      for (const c of r.columns)
        for (const e of c.elements)
          for (const [k, v] of Object.entries(e.component)) {
            if (k === '__typename' || typeof v !== 'string' || !v) continue
            if (['HeadingLevel', 'Variant', 'CalloutType', 'Initials'].includes(k)) continue // presentation, not copy
            for (const part of v.split(/\n+/)) out.push(part.replace(/^[✓→]\s*/, '').replace(/##/g, '').trim())
          }
  return out.filter(Boolean)
}

/* ===================================================================== tests */

console.log('\nhelpers')

test('formatStatValue keeps the legacy page formatting', () => {
  assert.equal(formatStatValue('15100'), '15.1K')
  assert.equal(formatStatValue('1500000'), '1.5M')
  assert.equal(formatStatValue('21'), '21')
  assert.equal(formatStatValue('5B+'), '5B+')
  assert.equal(formatStatValue('$380M'), '$380M')
  assert.equal(formatStatValue('30+'), '30+')
  assert.equal(formatStatValue('2,273'), '2.3K')
})

test('comparisonTableHtml: icon tokens AND the word, free text kept, html escaped, x-ray hook per row', () => {
  const html = comparisonTableHtml(
    [
      { Category: 'A & B', OurValue: 'Yes', CompetitorValue: 'Limited' },
      { Category: 'C', OurValue: '<b>raw</b>', CompetitorValue: 'No' },
    ],
    'Rival <CMS>',
  )
  assert.match(html, /<th>Rival &lt;CMS&gt;<\/th>/)
  assert.match(html, /\{true\}<span class="www-cell-label">Yes<\/span>/)
  assert.match(html, /\{warning\}<span class="www-cell-label">Limited<\/span>/)
  assert.match(html, /\{false\}<span class="www-cell-label">No<\/span>/)
  assert.match(html, /<td>A &amp; B<\/td>/)
  assert.match(html, /<td>&lt;b&gt;raw&lt;\/b&gt;<\/td>/)
  assert.equal(html.match(/data-xray="comparison-row"/g)?.length, 2)
})

test('richToStacked turns the legacy emphasis markup into a ##run##', () => {
  assert.equal(richToStacked('We know <em>CDW</em>'), 'We know ##CDW##')
  assert.equal(
    richToStacked('You\'re on <span class="text--highlight">AEM.</span><br>We hear you.'),
    "You're on ##AEM.##\nWe hear you.",
  )
  assert.equal(richToStacked(null), '')
  assert.equal(plain('A ##run## here'), 'A run here')
})

test('realContacts drops the generic role-title placeholders, as the legacy page did', () => {
  const kept = realContacts([
    { Initials: 'A', Name: 'Ada', Role: 'AE', Email: null },
    { Initials: 'S', Name: 'Solutions Architect', Role: '', Email: null },
    { Initials: 'C', Name: ' customer success manager ', Role: '', Email: null },
  ])
  assert.deepEqual(kept.map((m) => m.Name), ['Ada'])
})

test('the proof logos are labelled with the brand each image shows', () => {
  assert.deepEqual(
    PROOF_LOGOS.map((l) => l.alt),
    ['Alaska Airlines', 'Zoom', 'Salesforce', 'Admiral', 'The Royal Mint', 'Diligent'],
  )
})

test('the www design is the default; ?design=classic renders the previous one', () => {
  for (const q of ['', null, undefined, '?search=1', '?design=www', new URLSearchParams('a=1&design=www'), new URLSearchParams(''), '?template=takeout'])
    assert.equal(wantsWwwDesign(q), true, String(q))
  assert.equal(wantsWwwDesign('?design=classic'), false)
  assert.equal(wantsWwwDesign(new URLSearchParams('search=1&design=classic')), false)
})

test('isOfferExperience: by template, or by the component plan the offer workflow writes', () => {
  assert.equal(isOfferExperience({ template: 'offer' }), true)
  assert.equal(isOfferExperience({ componentPlan: '{"kind":"offer-page","blueprint":"offer"}' }), true)
  assert.equal(isOfferExperience({ template: 'abm-takeout', componentPlan: '{"kind":"account"}' }), false)
  assert.equal(isOfferExperience(null), false)
})

console.log('\nreadOffer')

test('every element lands on its blueprint key', () => {
  const s = readOffer(fullOffer() as never)
  const hero = s.find((x) => x.slot === 'hero')!
  assert.equal((hero.values.offerEyebrow as ElementData).Text, 'O-eyebrow')
  assert.equal((hero.values.offerHeadline as ElementData).Text, 'O-headline ##O-run##')
  assert.equal((hero.values.offerHighlights as ElementData[]).length, 2)
  assert.equal((hero.values.offerSecondaryCta as ElementData).ButtonText, 'O-cta-2')
  assert.equal(hero.extras.length, 0)
  assert.equal(s.find((x) => x.slot === 'offer-about')!.anchor, 'about')
})

test('legacy section names still map ("The problem", "Is this for you?")', () => {
  const s = readOffer(fullOffer() as never)
  assert.ok(s.find((x) => x.name === 'The problem')?.slot === 'offer-problem')
  assert.ok(s.find((x) => x.name === 'Is this for you?')?.slot === 'offer-fit')
})

test('a page that left the eyebrow out does not read its h1 as the eyebrow', () => {
  const [hero] = readOffer({
    composition: { nodes: [section('Hero', [el('StackedHeadingElement', { Text: 'Only a headline', HeadingLevel: 'h1' })])] },
  } as never)
  assert.equal(hero.values.offerEyebrow, undefined)
  assert.equal((hero.values.offerHeadline as ElementData).Text, 'Only a headline')
})

test('unclaimed elements are kept as extras; unknown sections are kept whole', () => {
  const s = readOffer(fullOffer() as never)
  assert.deepEqual(s.find((x) => x.slot === 'offer-faq')!.extras.map((e) => e.ButtonText), ['O-extra-button'])
  const unknown = s.find((x) => x.name === 'O-unknown-section')!
  assert.equal(unknown.slot, null)
  assert.equal(unknown.extras.length, 1)
})

test('OFFER_SLOTS is the offer blueprint, slot for slot and feed for feed', () => {
  const bp = offerBlueprint.slots
  assert.deepEqual(OFFER_SLOTS.map((s) => s.id), bp.map((s) => s.slotId))
  for (const slot of bp) {
    const ours = OFFER_SLOTS.find((s) => s.id === slot.slotId)!
    assert.equal(ours.names[0], slot.displayName, `${slot.slotId}: displayName`)
    assert.deepEqual(
      ours.feeds.map((f) => [f.key, f.type, !!f.many]),
      slot.feeds.map((f) => [f.flatKey, f.contentType, f.cardinality === 'many']),
      `${slot.slotId}: feeds`,
    )
  }
})

console.log('\nnothing is lost: account page')

const account = fullAccountPage()
const accountHtml = renderToString(<AccountPage page={account} />)
const accountText = textOf(accountHtml)

test('ACCOUNT_FIELDS covers the 67 content-type properties exactly once', () => {
  const names = ACCOUNT_FIELDS.map((f) => f.field)
  assert.equal(names.length, 67)
  assert.equal(new Set(names).size, 67)
  // The CMS property list (GET /v1/contenttypes/CompetitorComparisonPage, 2026-11-01).
  const cms = 'comparisonDescription logoWallCustomerSlot comparisonHeadline promoEyebrow comparisonTableRows testimonial1 testimonial1JobTitle testimonial1Company promoHeading promoDescription testimonial2 MetaDescription PageTitle eyebrow headline promoCTA promoCTALink brandDomain brandAccentColor salesforceAccountID intelEyebrow competitorName roiTitle migrationTitle stickyCTAText footerTagline intelHeadline challengeHeadline roiDescription migrationDescription ctaTitle footerLinks testimonial2JobTitle intelStats challengeScreenshotUrl roiCards timelinePhases ctaDescription footerLegal stakeholders challengeScreenshotAlt roiProjectionValue teamMembers ctaButtonText testimonial2Company techStack challengeBrowserUrl roiProjectionLabel modalScheduleUrl investments painPoints roiProjectionDetail newsItems analystHeadline subheadline analystQuote analystSource cta analystCTA link analystCTALink customerLogo endHeadline endSubheadline endCTA endCTALink analystCards'.split(' ')
  assert.deepEqual([...names].sort(), [...cms].sort())
})

/** Every string a field holds, flattened through arrays and {default} links. */
function stringsOf(v: unknown): string[] {
  if (typeof v === 'string') return [v]
  if (Array.isArray(v)) return v.flatMap(stringsOf)
  if (v && typeof v === 'object') return Object.values(v).flatMap(stringsOf)
  return []
}

for (const f of ACCOUNT_FIELDS.filter((x) => x.use === 'text')) {
  test(`text  ${f.field} → ${f.section}`, () => {
    let values = stringsOf(account[f.field]).filter((s) => !/^(https?:|var\(|Yes$|No$|Limited$|engaged$)/.test(s))
    if (f.field === 'teamMembers') values = ['F-team-name', 'F-team-role'] // the placeholder member is dropped on purpose
    if (f.field === 'stakeholders') values = ['F-stakeholder-name', 'F-stakeholder-role', 'F-stakeholder-note', 'In conversation']
    if (f.field === 'roiCards') values = ['F-metric-1', 'F-unit-1', 'F-roi-label-1', 'F-citation-1', 'F-metric-2', 'F-roi-label-2', 'F-citation-2']
    for (const raw of values) {
      // An extruded ##run## renders once per layer, so check the runs and the words between them.
      for (const part of richToStacked(raw).split(/##|\n/).map((p) => p.trim()).filter(Boolean))
        assert.ok(accountText.includes(part), `"${part}" is not on the page`)
    }
  })
}

const ATTR_EXPECT: Record<string, string[]> = {
  link: ['href="https://example.test/F-link"'],
  customerLogo: ['src="https://example.test/F-customerLogo.png"'],
  brandAccentColor: ['--www-accent:#0a1b2c'],
  challengeScreenshotUrl: ['src="https://example.test/F-challengeScreenshotUrl.png"'],
  challengeScreenshotAlt: ['alt="F-challengeScreenshotAlt"'],
  analystCTALink: ['href="https://example.test/F-analystCTALink"'],
  promoCTALink: ['href="https://example.test/F-promoCTALink"'],
  endCTALink: ['href="https://example.test/F-endCTALink"'],
  // In the connect panel the one closing CTA opens, not in the server HTML (see the test below).
  modalScheduleUrl: [],
}
for (const f of ACCOUNT_FIELDS.filter((x) => x.use === 'attr')) {
  test(`attr  ${f.field} → ${f.section}`, () => {
    const want = ATTR_EXPECT[f.field]
    assert.ok(want, `no attribute expectation for ${f.field}: add one to ATTR_EXPECT`)
    for (const w of want) assert.ok(accountHtml.includes(w), `${w} is not in the markup`)
  })
}

test('the stored "Schedule a call" link is in the connect panel the one closing CTA opens', () => {
  assert.equal(connectProps(account).scheduleUrl, 'https://example.test/F-modalScheduleUrl')
  assert.equal(fromLegacyPage(account).scheduleUrl, 'https://example.test/F-modalScheduleUrl')
  // ...and the close itself has one button, no second "Schedule a call".
  const from = accountHtml.indexOf('<section id="cta"')
  const close = accountHtml.slice(from, accountHtml.indexOf('</section>', from))
  assert.ok(!close.includes('F-modalScheduleUrl'), 'a second CTA in the close')
  assert.equal((close.match(/<button\b/g) ?? []).length, 1)
})

test('links inside arrays keep their targets (LinkedIn, person page, news, footer, analyst, citation, mail)', () => {
  for (const w of [
    'href="https://example.test/F-stakeholder-linkedin"',
    'href="/acme-corp/f-person-slug"',
    'href="https://example.test/F-news-url"',
    'href="https://example.test/F-footer-url"',
    'href="https://example.test/F-analyst-card-url"',
    'href="https://example.test/F-citation-url"',
    'href="mailto:f-team@example.test"',
  ])
    assert.ok(accountHtml.includes(w), `${w} missing`)
})

test('the old page\'s "#form" hero link points at the contact card', () => {
  const page = { ...fullAccountPage(), link: { default: 'https://showcase.optimizely.com/acme#form' } }
  const html = renderToString(<AccountPage page={page as CompetitorComparisonPage} />)
  assert.match(html, /<a href="#cta"[^>]*>F-cta</)
  assert.match(html, /id="form"/)
})

test('the competitor tool is flagged, the others are not', () => {
  assert.equal(accountHtml.match(/www-stack-pill--flag/g)?.length, 1)
})

test('sections keep the ids the ODP tracking hook observes', () => {
  for (const id of ['hero', 'intel', 'challenge', 'comparison', 'proof', 'roi', 'migration', 'cta'])
    assert.ok(accountHtml.includes(`id="${id}"`), `#${id} missing`)
})

test('an account page with only the required minimum still renders (no crash on nulls)', () => {
  const sparse = {
    _metadata: { key: 'k', url: { default: '/s/', hierarchical: '/s/' }, published: '' },
    headline: 'Sparse',
  } as unknown as CompetitorComparisonPage
  const html = renderToString(<AccountPage page={sparse} />)
  assert.match(textOf(html), /Sparse/)
})

console.log('\nthe brief: a landing page, not a site page')

/** Text of every extruded run: StackedHeading draws each one as stacked, aria-hidden layers. */
function extrudedRuns(html: string): Set<string> {
  const runs = new Set<string>()
  for (const m of html.matchAll(/<span aria-hidden="true" class="[^"]*pointer-events-none select-none[^"]*"[^>]*>([^<]*)<\/span>/g)) runs.add(m[1])
  return runs
}

test('no site navigation and no footer, on either page', () => {
  for (const html of [accountHtml, renderToString(<OfferPage experience={fullOffer()} />)]) {
    assert.ok(!/<nav[\s>]/.test(html), 'a <nav> is rendered')
    assert.ok(!/<footer[\s>]/.test(html), 'a <footer> is rendered')
    assert.ok(!/<header[\s>]/.test(html), 'a <header> is rendered')
  }
})

test('one extruded moment per page (brand rule): the ROI number on the account page', () => {
  assert.deepEqual([...extrudedRuns(accountHtml)], ['F-roiProjectionValue'])
})

test('one extruded moment per page: the run the writer marked in the offer headline', () => {
  assert.deepEqual([...extrudedRuns(renderToString(<OfferPage experience={fullOffer()} />))], ['O-run'])
})

test('reveal animations can never hide content from a reader without JS', () => {
  // The boot script that arms the reveal styles comes before any scene in the markup...
  const boot = accountHtml.indexOf("classList.add('www-js')")
  assert.ok(boot > -1 && boot < accountHtml.indexOf('data-scene'), 'boot script missing or after the content')
  // ...and every scene is a full, ordered part of the server HTML (nothing is client-only).
  const ids = [...accountHtml.matchAll(/<section id="([^"]+)" data-scene/g)].map((m) => m[1])
  assert.deepEqual(ids, ['hero', 'intel', 'signals', 'challenge', 'comparison', 'proof', 'analysts', 'promo', 'roi', 'migration', 'cta'])
})

test('a scene with nothing to say is left out rather than rendered empty', () => {
  const sparse = { ...fullAccountPage(), painPoints: null, challengeHeadline: null, challengeScreenshotUrl: null, analystCards: null, analystHeadline: null, analystQuote: null, promoHeading: null }
  const html = renderToString(<AccountPage page={sparse as unknown as CompetitorComparisonPage} />)
  for (const id of ['challenge', 'analysts', 'promo']) assert.ok(!html.includes(`id="${id}"`), `#${id} rendered empty`)
  // A stored screenshot alone still gets its scene: no stored content is dropped.
  const shotOnly = renderToString(<AccountPage page={{ ...sparse, challengeScreenshotUrl: { default: 'https://example.test/shot.png' } } as unknown as CompetitorComparisonPage} />)
  assert.match(shotOnly, /id="challenge"[\s\S]*https:\/\/example\.test\/shot\.png/)
})

test('metric units: a symbol stays with its number, a word unit is set smaller', () => {
  const page = { ...fullAccountPage(), roiCards: [{ Metric: '26', Unit: '%', Label: 'L1', CitationText: null }, { Metric: '700', Unit: 'hours', Label: 'L2', CitationText: null }] }
  const html = renderToString(<AccountPage page={page as unknown as CompetitorComparisonPage} />)
  assert.match(html, /<span>26<\/span>%<\/dd>/)
  assert.match(html, /<span class="www-number__unit"> <!-- -->hours<\/span>/)
})

console.log('\nnothing is lost: offer page')

const offer = fullOffer()
const offerHtml = renderToString(<OfferPage experience={offer} />)
const offerText = textOf(offerHtml)

/** The FAQ answers, which the accordion mounts on open: they travel in the FAQPage data instead. */
const faqLd = JSON.parse(offerHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? 'null')

test('every string of every element in the composition is on the page', () => {
  const answers = new Set(['O-a-1', 'O-a-2'])
  const missing = compositionStrings(offer).filter((s) => !answers.has(s) && !offerText.includes(s) && !offerHtml.includes(s))
  assert.deepEqual(missing, [])
})

test('offer links keep their targets', () => {
  for (const w of [
    'href="https://example.test/O-cta"',
    'href="#about"',
    'href="https://example.test/O-story-1"',
    'href="mailto:o-host@example.test"',
    'href="https://example.test/O-close-url"',
    'href="https://example.test/O-extra"',
  ])
    assert.ok(offerHtml.includes(w), `${w} missing`)
})

test('offer sign-up: when the offer chose the email form, the www close shows it in place of the button', () => {
  const offer = fullOffer() as unknown as { composition: unknown }
  const tagged = JSON.parse(JSON.stringify(offer), (k, v) => (v && v.__typename === 'AbmClosingCtaElement' ? { ...v, SignupOfferId: 'offer-123' } : v))
  const html = renderToString(<OfferPage experience={tagged} />)
  assert.match(html, /data-offer-signup=""/)
  assert.match(html, /<input[^>]*type="email"/)
  assert.ok(!html.includes('href="https://example.test/O-close-url"'), 'the close still links out')
  assert.match(html, /O-close-button/)
  assert.equal((html.match(/id="signup"/g) ?? []).length, 1, 'the signup anchor twice')
  // Without the tag: the button, as before.
  const plainHtml = renderToString(<OfferPage experience={fullOffer()} />)
  assert.ok(!/data-offer-signup/.test(plainHtml) && plainHtml.includes('href="https://example.test/O-close-url"'))
})

test('the about section keeps its anchor and the hero run is extruded', () => {
  assert.match(offerHtml, /id="about"/)
  assert.ok((offerHtml.match(/O-run/g) ?? []).length > 1, 'an extruded run renders once per layer')
})

test('every FAQ question and answer is in the server HTML as FAQPage data (answers open on click)', () => {
  assert.equal(faqLd?.['@type'], 'FAQPage')
  assert.deepEqual(
    faqLd.mainEntity.map((q: { name: string; acceptedAnswer: { text: string } }) => [q.name, q.acceptedAnswer.text]),
    [['O-q-1', 'O-a-1'], ['O-q-2', 'O-a-2']],
  )
})

test('an answer cannot break out of the FAQ script', () => {
  const page = fullOffer()
  ;(page.composition.nodes[8].rows[1].columns[0].elements[0].component as Record<string, unknown>).Answer = '</script><b>x</b>'
  const html = renderToString(<OfferPage experience={page} />)
  assert.ok(!html.includes('</script><b>x</b>'))
})

console.log('\nX-ray and Edit mode hooks')

test('every ABM x-ray selector also matches its data-xray hook', () => {
  for (const s of ABM_XRAY_DEFAULTS) assert.ok(s.selector.includes(`[data-xray="${s.id}"]`), s.id)
})

test('the takeout account page carries a data-xray hook for every legacy x-ray section', () => {
  const missing = ABM_XRAY_LEGACY_IDS.filter((id) => !accountHtml.includes(`data-xray="${id}"`))
  assert.deepEqual(missing, [])
})

/* ------------------------------------------------------ agent platform template */

console.log('\nagent platform template: the adapter (existing pages into the new structure)')

/**
 * A realistic synthetic account (no real company or person): a replaced CMS plus a second CMS,
 * marketing automation, analytics, a CDP, a traffic figure and a stat about Optimizely.
 */
function stackPage(over: Record<string, unknown> = {}): CompetitorComparisonPage {
  return {
    ...fullAccountPage(),
    competitorName: 'Adobe Experience Manager',
    intelHeadline: 'We know <em>Northwind Freight</em>',
    intelStats: [
      { Value: '12000', Label: 'employees' },
      { Value: '3.2M', Label: 'monthly visitors' },
      { Value: '40', Label: 'countries served' },
      { Value: '3', Label: 'Optimizely products in use' },
      { Value: '1998', Label: 'founded' },
    ],
    techStack: [
      { Name: 'Adobe Experience Manager', ColorTag: 'var(--orange)' },
      { Name: 'Sitecore', ColorTag: null },
      { Name: 'Marketo', ColorTag: null },
      { Name: 'Google Analytics 4', ColorTag: null },
      { Name: 'Tealium', ColorTag: null },
      { Name: 'Salesforce', ColorTag: null },
      { Name: 'OneTrust', ColorTag: null },
      { Name: 'Bynder', ColorTag: null },
      { Name: 'Marketo', ColorTag: null },
    ],
    investments: [
      { Name: 'Global content localization', IsPrimary: true },
      { Name: 'Customer data unification', IsPrimary: false },
    ],
    stakeholders: [
      { Initials: 'PE', Name: 'Pat Example', Role: 'Chief Marketing Officer', LinkedInUrl: null },
      { Initials: 'SE', Name: 'Sam Example', Role: 'Director of Digital Experience', LinkedInUrl: null },
      { Initials: 'KE', Name: 'Kim Example', Role: 'Head of Marketing Operations', LinkedInUrl: null },
      { Initials: 'LE', Name: 'Lee Example', Role: 'VP Content and Brand', LinkedInUrl: null },
    ],
    teamMembers: [
      { Initials: 'SD', Name: 'F-sdr-name', Role: 'Strategic Account Development Representative', Email: 'f-sdr@example.test' },
      { Initials: 'FT', Name: 'F-team-name', Role: 'Enterprise Account Executive', Email: 'f-team@example.test' },
      { Initials: 'SA', Name: 'Solutions Architect', Role: 'placeholder', Email: null },
    ],
    ...over,
  } as unknown as CompetitorComparisonPage
}

test('state: a stored Optimizely tool or stat reads as customer, anything else as prospect', () => {
  assert.equal(deriveState(stackPage({ intelStats: [] })).value, 'prospect')
  assert.equal(deriveState(stackPage()).value, 'customer') // "3 Optimizely products in use"
  assert.equal(deriveState(stackPage({ intelStats: [], techStack: [{ Name: 'Optimizely Web Experimentation', ColorTag: null }] })).value, 'customer')
})

test('state: ?state= overrides for review, an unknown value is ignored', () => {
  const page = stackPage({ intelStats: [] })
  assert.equal(fromLegacyPage(page, { state: 'open-opp' }).state.value, 'open-opp')
  assert.equal(fromLegacyPage(page, { state: 'nonsense' as never }).state.value, 'prospect')
})

test('N8: traffic figures and stats about Optimizely never become account facts', () => {
  const c = fromLegacyPage(stackPage())
  assert.deepEqual(c.pills.value, ['12K employees', '40 countries served', 'Founded 1998'])
  assert.deepEqual(c.stats.value, [], 'the homework tiles repeat no hero fact')
  const more = fromLegacyPage(stackPage({ intelStats: [...(stackPage().intelStats ?? []), { Value: '86', Label: 'NPS' }, { Value: '5', Label: 'business units' }] }))
  assert.deepEqual(more.stats.value.map((s) => s.label), ['NPS', 'business units'])
})

test('N2: the replaced platform, and any tool in its category, show as the category only', () => {
  const tools = readStack(stackPage().techStack, 'Adobe Experience Manager')
  const aem = tools.find((t) => t.name === 'Adobe Experience Manager')!
  const sitecore = tools.find((t) => t.name === 'Sitecore')!
  assert.ok(aem.competitor && sitecore.competitor, 'both CMSs are competitors')
  assert.equal(aem.label, 'Your CMS')
  assert.equal(sitecore.label, 'Your CMS')
  assert.ok(!tools.find((t) => t.name === 'Marketo')!.competitor)
  assert.equal(tools.filter((t) => t.name === 'Marketo').length, 1, 'duplicates are dropped')
})

test('N2: an orange-tagged tool is a competitor even without a competitor name', () => {
  const tools = readStack([{ Name: 'Contentful', ColorTag: 'var(--orange)' }, { Name: 'Marketo', ColorTag: null }], null)
  assert.equal(tools[0].label, 'Your CMS')
  assert.equal(tools[1].label, 'Marketo')
})

test('stack tiles: at most six, Optimizely first, one tile per competitor category', () => {
  const tools = readStack([{ Name: 'Optimizely CMS', ColorTag: null }, ...(stackPage().techStack ?? [])], 'Adobe Experience Manager')
  const tiles = stackTiles(tools)
  assert.ok(tiles.length <= 6)
  assert.ok(tiles[0].ours)
  assert.equal(tiles.filter((t) => t.label === 'Your CMS').length, 1)
  assert.ok(!tiles.some((t) => t.category === 'Consent'), 'consent tools are not a layer worth a tile')
})

test('use cases rank from stored evidence; a tie goes to content operations', () => {
  const c = fromLegacyPage(stackPage())
  assert.equal(c.themes.value[0], 'content-ops') // CMS + DAM in the stack, "content localization" primary
  assert.equal(c.themes.value.length, 5)
  const tie = fromLegacyPage(stackPage({ techStack: [], investments: [] }))
  assert.deepEqual(tie.themes.value, THEME_ORDER)
  const testing = fromLegacyPage(stackPage({ techStack: [{ Name: 'VWO', ColorTag: null }, { Name: 'AB Tasty', ColorTag: null }], investments: [{ Name: 'Experimentation program', IsPrimary: true }] }))
  assert.equal(testing.themes.value[0], 'optimization')
})

test('N3: teams come from stakeholder roles (three or more groups), else the default', () => {
  const c = fromLegacyPage(stackPage())
  assert.equal(c.teams.from, 'derived')
  assert.ok(c.teams.value.includes('Marketing leadership') && c.teams.value.includes('Content and brand'))
  const few = fromLegacyPage(stackPage({ stakeholders: [] }))
  assert.equal(few.teams.from, 'template')
  assert.deepEqual(few.teams.value, DEFAULT_TEAMS)
})

test('N4: a named rep only for an open opportunity or a customer, and never a placeholder', () => {
  const page = stackPage({ intelStats: [] })
  assert.deepEqual(fromLegacyPage(page).rep.value.named, [])
  for (const state of ['open-opp', 'customer'] as const) {
    assert.deepEqual(fromLegacyPage(page, { state }).rep.value.named.map((p) => p.name), ['F-team-name'])
  }
  for (const state of ['evaluated', 'ex-customer'] as const) assert.deepEqual(fromLegacyPage(page, { state }).rep.value.named, [])
  // Only the account executive is named; with none stored, the team pod.
  const noAe = stackPage({ intelStats: [], teamMembers: [{ Initials: 'SD', Name: 'F-sdr-name', Role: 'Sales Development Representative', Email: null }] })
  assert.deepEqual(fromLegacyPage(noAe, { state: 'open-opp' }).rep.value.named, [])
})

test('every one of the 67 stored fields is either used (and where) or deliberately not shown (and why)', () => {
  const used = USED_FIELDS.map((f) => f.field)
  const off = NOT_SHOWN.map((f) => f.field)
  assert.deepEqual(used.filter((f) => off.includes(f)), [], 'a field is in both lists')
  assert.deepEqual([...used, ...off].sort(), ACCOUNT_FIELDS.map((f) => f.field).sort())
  assert.ok(NOT_SHOWN.every((f) => f.rule.length > 8), 'every hidden field names its rule')
})

console.log('\nagent platform template: the page')

const apSearch = (s: string) => renderToString(<WwwAccountRoute page={stackPage({ intelStats: stackPage().intelStats?.filter((x) => !/Optimizely/.test(x.Label)) })} search={s} />)
const apHtml = apSearch('')
const apText = textOf(apHtml)

/** The visible copy a reader gets, excluding the review layer. */
function readerText(html: string) {
  return textOf(
    html
      .replace(/<aside class="www-review"[\s\S]*?<\/aside>/, '')
      // Not reading load: screen-reader-only text ("opens in new tab"), and anything hidden from
      // assistive tech (icon ligatures, the stacked layers of the extruded run).
      .replace(/<(span|dt|p)[^>]*class="sr-only"[^>]*>[^<]*(<!-- -->[^<]*)*<\/\1>/g, '')
      .replace(/<span[^>]*aria-hidden="true"[^>]*>[^<]*<\/span>/g, ''),
  )
}

test('the agent platform template is the default; ?template=takeout is the takeout page', () => {
  const ids = (html: string) => [...html.matchAll(/<section id="([^"]+)" data-scene/g)].map((m) => m[1])
  assert.deepEqual(ids(apHtml), ['hero', 'who', 'intel', 'language', 'usecases', 'proof', 'migration', 'cta'])
  assert.deepEqual(ids(apSearch('?template=takeout')), ['hero', 'intel', 'signals', 'challenge', 'comparison', 'proof', 'analysts', 'promo', 'roi', 'migration', 'cta'])
})

test('hero: "Personalized for", the identity sentence first, no account name in the H1', () => {
  assert.match(apText, /Personalized for Northwind Freight/)
  assert.match(apText, new RegExp(IDENTITY_SENTENCE.replace(/\./g, '\\.') + ' Our agent platform sits on top of the tools Northwind Freight'))
  const h1 = textOf(apHtml.match(/<h1[\s\S]*?<\/h1>/)![0])
  assert.ok(!/Northwind/.test(h1), h1)
})

test('hero: the page says whose it is once, with their logo above the H1 (Michiel, 2 Nov)', () => {
  for (const [name, html] of [['agent platform', apHtml], ['takeout', accountHtml]] as const) {
    const hero = html.slice(html.indexOf('<section id="hero"'), html.indexOf('</section>'))
    const mark = hero.search(/class="www-account[ "]/)
    assert.ok(mark > -1 && mark < hero.indexOf('<h1'), `${name}: no account logo above the H1`)
    assert.match(hero, /class="www-account__logo"><img src="https:\/\/example\.test\/F-customerLogo\.png"/)
    // One personalization line: no "Made for" in the corner, no account name on the landscape.
    assert.ok(!/Made for|Built for/.test(textOf(hero)), `${name}: a second personalization line`)
  }
  const hero = apHtml.slice(0, apHtml.indexOf('</section>'))
  assert.equal(textOf(hero).match(/Personalized for/g)?.length, 1)
  assert.match(textOf(hero), /Agents at work Illustrative/)
})

test('hero: full screen, its landscape in every size up to 2880px wide', () => {
  for (const html of [apHtml, accountHtml, renderToString(<OfferPage experience={fullOffer()} />)]) {
    assert.match(html, /<section id="hero" data-scene(="true")? class="www-hero is-in"><div class="www-hero__card/)
    assert.match(html, /mountain-wide-2880\.avif 2880w/)
    assert.match(html, /fetchPriority="high"|fetchpriority="high"/)
  }
})

test('takeout: the stored site screenshot is in the challenge scene at its own size, not stretched on the hero', () => {
  const hero = accountHtml.slice(0, accountHtml.indexOf('</section>'))
  assert.ok(!hero.includes('F-challengeScreenshotUrl'), 'the screenshot is still on the hero')
  const from = accountHtml.indexOf('<section id="challenge"')
  const challenge = accountHtml.slice(from, accountHtml.indexOf('</section>', from))
  assert.match(challenge, /data-xray="challenge-screenshot"[\s\S]*src="https:\/\/example\.test\/F-challengeScreenshotUrl\.png"/)
  assert.match(challenge, /F-challengeBrowserUrl/)
})

test('homework runs through the page: one fact per scene, not one homework section (Laura, Dan)', () => {
  const facts = [
    { Value: '12000', Label: 'employees' },
    { Value: '40', Label: 'countries served' },
    { Value: '1998', Label: 'founded' },
    { Value: '310', Label: 'distribution centers' },
    { Value: '9', Label: 'brands' },
    { Value: '2.1B', Label: 'parcels a year' },
    { Value: '64', Label: 'ports served' },
  ]
  const html = renderToString(<WwwAccountRoute page={stackPage({ intelStats: facts })} search="" />)
  assert.ok(!/We did our homework/.test(html), 'a single homework section')
  const sceneOf = (needle: string) => {
    const at = html.indexOf(needle)
    return [...html.slice(0, at).matchAll(/<section id="([^"]+)"/g)].pop()?.[1]
  }
  // The three hero pills, then one fact in each of four scenes, each said once.
  assert.deepEqual(
    ['distribution centers', 'brands', 'parcels a year', 'ports served'].map((l) => sceneOf(`<p class="www-note__label">${l}</p>`)),
    ['intel', 'usecases', 'proof', 'migration'],
  )
  for (const l of ['employees', 'distribution centers', 'ports served']) assert.equal(textOf(html).split(l).length - 1, 1, `"${l}" said twice`)
  // Every homework fact is an X-ray "intel-stats" hook, and carries the same tag.
  assert.equal((html.match(/<aside[^>]*data-xray="intel-stats"/g) ?? []).length, 4)
  assert.ok((textOf(html).match(/Our homework/g) ?? []).length >= 6)
  // The use cases say what in the page's own data put them first (stack and investments, N2-safe).
  assert.match(textOf(html), /In your stack Bynder On your agenda Global content localization/)
  assert.match(textOf(html), /In your stack Tealium On your agenda Customer data unification/)
  assert.equal(sceneOf('Where Northwind Freight is investing'), 'language')
})

test('N2: the competitor\'s own product line is shown by category too (Norsk Stål, from the live sweep)', () => {
  const tools = readStack(
    [{ Name: 'DynamicWeb CMS', ColorTag: null }, { Name: 'DynamicWeb PIM', ColorTag: null }, { Name: 'DynamicWeb eCommerce', ColorTag: null }, { Name: 'Google Tag Manager', ColorTag: null }],
    'DynamicWeb',
  )
  assert.deepEqual(tools.filter((t) => t.competitor).map((t) => t.name), ['DynamicWeb CMS', 'DynamicWeb PIM', 'DynamicWeb eCommerce'])
  const html = renderToString(<WwwAccountRoute page={stackPage({ competitorName: 'DynamicWeb', techStack: tools.map((t) => ({ Name: t.name, ColorTag: null })) })} search="" />)
  assert.ok(!/DynamicWeb/i.test(textOf(html.replace(/<script[\s\S]*?<\/script>/g, ''))), 'DynamicWeb is on the page')
  assert.match(textOf(html), /Your CMS/)
})

test('N3: stored small print that names one of the account\'s people is left off (UpGuard, from the live sweep)', () => {
  const c = fromLegacyPage(stackPage({ footerTagline: 'Personalized for Pat Example at Northwind Freight', footerLegal: 'This page was created for Northwind Freight.' }))
  assert.equal(c.smallPrint.tagline, null)
  assert.equal(c.smallPrint.legal, 'This page was created for Northwind Freight.')
  assert.ok(!personMatcher([{ Name: 'Pat Example' }])('Examples of the platform'), 'matches inside a word')
  // Investments and facts that name their people are left off too (MDA National, SEI, Saxo Bank).
  const d = fromLegacyPage(
    stackPage({
      investments: [{ Name: 'Executive team led by CEO Pat Example', IsPrimary: true }, { Name: 'Global content localization', IsPrimary: false }],
      intelStats: [{ Value: '12000', Label: 'employees' }, { Value: 'Sitecore CMS', Label: 'in place today' }, { Value: '40', Label: 'countries served' }, { Value: '1', Label: 'new CMO, Sam Example' }],
      competitorName: 'Sitecore',
    }),
  )
  assert.deepEqual(d.priorities.value, ['Global content localization'])
  assert.ok(![...d.pills.value, ...d.stats.value.map((x) => `${x.value} ${x.label}`)].some((t) => /Sitecore|Sam Example/.test(t)))
  // Not names: a role stored as a name, the account's own name, an Optimizely person listed as a stakeholder.
  const m = personMatcher([{ Name: 'Marketing leadership' }, { Name: 'Sam Edelman' }, { Name: 'Caleb Ping' }], { account: 'Sam Edelman', team: [{ Name: 'Caleb Ping' }] })
  assert.ok(!m('Marketing leadership') && !m('Sam Edelman footwear') && !m('Caleb Ping'))
})

test('a use-case homework line never names a competitor (N2)', () => {
  const c = fromLegacyPage(stackPage({ investments: [{ Name: 'AEM upgrade', IsPrimary: true }, { Name: 'Global content localization', IsPrimary: false }] }))
  for (const w of Object.values(c.why.value)) {
    const line = [...w!.stack, ...w!.plans].join(' ')
    assert.ok(!/AEM|Adobe|Sitecore|Your CMS/.test(line), line)
  }
  // One piece of evidence backs one use case: two cards never repeat each other (Carhartt).
  const both = fromLegacyPage(
    stackPage({
      techStack: [{ Name: 'Tealium', ColorTag: null }, { Name: 'Salesforce Interaction Studio', ColorTag: null }, { Name: 'Google Analytics 4', ColorTag: null }, { Name: 'Snowflake', ColorTag: null }],
      investments: [{ Name: 'Customer data and personalization', IsPrimary: true }],
    }),
  )
  const seen = Object.values(both.why.value).flatMap((w) => [...w!.stack, ...w!.plans])
  assert.equal(new Set(seen).size, seen.length, `repeated: ${seen.join(', ')}`)
  // Stored investment names are shown as written: never re-cased into a sentence ("tyler AI").
  const t = fromLegacyPage(stackPage({ investments: [{ Name: 'Tyler AI across the product suite', IsPrimary: true }] }))
  assert.deepEqual(t.why.value.geo?.plans, ['Tyler AI across the product suite'])
})

test('motion: every heading word, waypoint effect and the hero intro are presentation only', () => {
  // Words are spans with the spaces left as text, so the heading reads and copies as one.
  assert.match(apHtml, /<span class="www-w" style="--w:0">Who<\/span> <span class="www-w" style="--w:1">we<\/span>|<span class="www-w" style="--w:0">One<\/span> <span class="www-w" style="--w:1">platform<\/span>/)
  assert.match(textOf(apHtml), /One platform to create, optimize and run digital experiences with AI agents\./)
  for (const fx of ['left', 'right', 'drop', 'scale']) assert.match(apHtml, new RegExp(`data-reveal="${fx}"`), fx)
})

test('N2 and N3: no competitor name and no stakeholder name anywhere in the markup', () => {
  for (const name of ['Adobe Experience Manager', 'Sitecore', 'Pat Example', 'Sam Example', 'Kim Example', 'Lee Example']) {
    assert.ok(!apHtml.includes(name), `${name} is on the page`)
  }
  assert.match(apText, /Your CMS/)
})

test('N1: no comparison table, no incumbent framing, no legacy challenge copy', () => {
  assert.ok(!/<table/.test(apHtml.replace(/<aside class="www-review"[\s\S]*?<\/aside>/, '')))
  for (const f of ['F-challengeHeadline', 'F-pain-1', 'F-comparisonHeadline', 'F-row-1']) assert.ok(!apHtml.includes(f), f)
})

test('the close has one call to action (Michiel, 2 Nov: one CTA, not two)', () => {
  const band = apHtml.match(/<div[^>]*class="www-close-band"[\s\S]*?<\/button><\/div>/)![0]
  const actions = band.match(/<(a|button)\b/g) ?? []
  assert.equal(actions.length, 1, band)
  assert.match(band, /id="cta-connect-btn"/)
  assert.ok(!/Explore the agent platform/.test(apHtml))
})

test('no account colours: the stored accent colour is nowhere on the page (gate 2)', () => {
  assert.ok(!apHtml.toLowerCase().includes('#0a1b2c'))
  assert.ok(!/--www-accent/.test(apHtml))
})

test('N12: build logic stays out of the production page; ?review=1 shows it', () => {
  for (const word of ['6QA', 'MUV', 'Track B', 'Build logic', 'withheld', 'provenance', 'Prospect', 'takeout', 'derived']) {
    assert.ok(!readerText(apHtml).includes(word), `"${word}" on the production page`)
  }
  assert.ok(!apHtml.includes('www-review'))
  const review = apSearch('?review=1')
  assert.match(review, /class="www-review"/)
  assert.match(textOf(review), /Review · Customer|Review · Prospect/)
})

test('N14: the reader gets 750 words or fewer', () => {
  const words = readerText(apHtml).split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length
  console.log(`       (${words} words)`)
  if (process.env.WWW_DUMP) console.log(readerText(apHtml))
  assert.ok(words <= 750, `${words} words`)
})

test('one extruded moment per page: the run in the state headline', () => {
  assert.deepEqual([...extrudedRuns(apHtml)], ['put them to work'])
})

test('the state sets the hero look, the proof track and whether the rep is named', () => {
  const look = (html: string) => html.match(/www-hero__card--(\w+)/)![1]
  const prospect = apHtml
  const opp = apSearch('?state=open-opp')
  assert.equal(look(prospect), 'darkfir')
  assert.equal(look(opp), 'darkfir')
  assert.equal(look(apSearch('?state=evaluated')), 'neutral2')
  assert.equal(look(apSearch('?state=customer')), 'neutral3')
  assert.equal(look(apSearch('?state=ex-customer')), 'ltblue')
  // Track A for a prospect: reads, no customer logos or names. Track B otherwise.
  assert.ok(!/Diligent|Corinthia|Robinson/.test(prospect))
  assert.match(opp, /Diligent/)
  // Rep named only where the state allows it (the hero button names them too).
  assert.ok(!prospect.includes('F-team-name'))
  assert.match(textOf(opp), /F-team-name/)
  assert.match(textOf(opp), /Arrange a session with F-team-name/)
  assert.ok(!opp.includes('F-sdr-name'), 'a non-AE team member is named')
})

test('the stored stack fills the 90-day Connect step by category, nothing replaced', () => {
  assert.match(apText, /Link (CMS|marketing automation|analytics|digital assets|customer data|CRM)[A-Za-z ,]* and [A-Za-z ]+\. Nothing gets replaced\./)
  assert.ok(!/\b(cms|crm|abm)\b/.test(apText), 'an acronym in lower case')
})

test('N1 and N2 in stored free text: the takeout sticky line is replaced, lines naming the platform are left off', () => {
  const html = renderToString(
    <WwwAccountRoute
      page={stackPage({
        stickyCTAText: 'Your AEM exit plan is ready',
        investments: [{ Name: 'AEM upgrade', IsPrimary: true }, { Name: 'Sitecore sunset', IsPrimary: false }, { Name: 'Global content localization', IsPrimary: false }],
        footerTagline: 'Built to replace Adobe Experience Manager',
        intelStats: [{ Value: '4000', Label: 'AEM pages' }, { Value: '12000', Label: 'employees' }],
      })}
    />,
  )
  for (const s of ['AEM', 'Sitecore', 'Adobe Experience Manager', 'exit plan']) assert.ok(!html.includes(s), `"${s}" is on the page`)
  assert.match(textOf(html), /Global content localization/)
  const many = fromLegacyPage(stackPage({ investments: ['a', 'b', 'c', 'd', 'e', 'f'].map((n, i) => ({ Name: `I-${n}`, IsPrimary: i === 5 })) }))
  assert.deepEqual(many.priorities.value, ['I-f', 'I-a', 'I-b', 'I-c'], 'primary first, at most four')
  assert.match(textOf(html), /12K employees/)
  const m = competitorMatcher(readStack(stackPage().techStack, 'Adobe Experience Manager'), 'Adobe Experience Manager')
  assert.ok(m('Our AEM rollout') && m('Sitecore XP') && !m('Teamwork across brands') && !m('Taem'))
})

test('N2 in the head: the tab title, description and link preview do not carry the takeout pitch', () => {
  const head = agentPlatformHead(stackPage({ PageTitle: 'Northwind - Why Optimizely over Adobe Experience Manager', MetaDescription: 'Move from AEM to Optimizely' }))
  assert.equal(head.PageTitle, 'Optimizely agent platform · Personalized for Northwind Freight')
  assert.ok(head.MetaDescription.startsWith(IDENTITY_SENTENCE))
  assert.ok(!/Adobe|AEM/.test(head.PageTitle + head.MetaDescription))
  assert.equal(head.testimonial1, null)
  assert.equal(head.analystCards, null)
})

test('stored small print is kept', () => {
  assert.ok(!apText.includes('F-stickyCTAText'))
  assert.match(apText, /F-footerTagline/)
  assert.match(apText, /F-footerLegal/)
  assert.match(apHtml, /F-customerLogo\.png/)
})

test('the agent platform page carries a hook for each of its X-ray sections, the takeout page for the legacy ones', () => {
  const reused = ['hero-title', 'hero-subtitle', 'intel-headline', 'intel-stats', 'tech-stack', 'investments', 'timeline-phases', 'team-members', 'cta-title', 'cta-description']
  const want = [...AGENT_PLATFORM_XRAY.map((s) => s.id), ...reused]
  assert.deepEqual(want.filter((id) => !apHtml.includes(`data-xray="${id}"`)), [])
  const takeout = apSearch('?template=takeout')
  assert.deepEqual(ABM_XRAY_LEGACY_IDS.filter((id) => !takeout.includes(`data-xray="${id}"`)), [])
})

test('the one-click ask: buttons, no form anywhere on the page', () => {
  assert.ok(!/<form[\s>]/.test(apHtml))
  assert.match(apHtml, /id="hero-connect-btn"/)
  assert.match(apHtml, /id="sticky-connect-btn"/)
  assert.match(apHtml, /id="cta-connect-btn"/)
})

console.log('\nEdit mode on the agent platform page')

test('Edit mode offers the parts a page field drives, each with its fields, all on the page', () => {
  const hero = apHtml.slice(0, apHtml.indexOf('</section>'))
  for (const sec of AGENT_PLATFORM_EDIT) {
    const id = sec.selector.match(/data-xray="([^"]+)"/)![1]
    assert.ok((sec.selector.startsWith('#hero') ? hero : apHtml).includes(`data-xray="${id}"`), `no hook for ${sec.title} (${id})`)
    assert.ok(sec.fields.length && sec.fields.every((f) => USED_FIELDS.some((u) => u.field === f)), `${sec.title}: a field this template does not use`)
    assert.ok(sec.fields.every((f) => (LIVE_FIELDS as readonly string[]).includes(f)), `${sec.title}: a field the live preview cannot show`)
    assert.ok(sec.hint.length > 10, `${sec.title} has no hint`)
  }
  // Template copy is not offered: no field could change it.
  for (const t of ['Who we are', 'Proof', 'First 90 days', 'Hero headline']) assert.ok(!AGENT_PLATFORM_EDIT.some((s) => s.title === t), t)
})

test('every field a live edit can change has the page elements that render it marked', () => {
  const marked = new Set([...apSearch('?state=customer').matchAll(/data-field="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)))
  for (const f of LIVE_FIELDS) assert.ok(marked.has(f), `no data-field="${f}" on the page`)
})

test('the request to Mark names the template and the fields behind each commented section', () => {
  const ap = buildSuggestedEdit(
    [
      { title: 'What they run today', feedback: 'They moved to Shopify Plus', fields: ['techStack'] },
      { title: 'Small print', feedback: 'Drop the tagline', fields: ['footerTagline', 'footerLegal'] },
    ],
    'agent-platform',
  )
  assert.ok(ap.startsWith(AGENT_PLATFORM_TEMPLATE_LINE))
  assert.match(ap, /Section: What they run today\nFields: techStack\nFeedback: They moved to Shopify Plus\n\n---\n\nSection: Small print\nFields: footerTagline, footerLegal\nFeedback: Drop the tagline/)
  // The takeout and legacy pages send exactly what they always did.
  assert.equal(buildSuggestedEdit([{ title: 'Hero headline', feedback: 'Shorter' }]), 'Section: Hero headline\nFeedback: Shorter')
})

test('a live edit re-renders the page from the new value: every place the field shows changes together', () => {
  const base = stackPage({ intelStats: [{ Value: '12000', Label: 'employees' }, { Value: '40', Label: 'countries served' }, { Value: '1998', Label: 'founded' }, { Value: '310', Label: 'distribution centers' }] })
  const edited = mergeLive(base, {
    // New tools go first: the page shows at most six (agent v1.4 is told so).
    techStack: [{ Name: 'Shopify Plus', ColorTag: null }, ...(base.techStack ?? [])],
    intelStats: [{ Value: '13500', Label: 'employees' }, ...(base.intelStats ?? []).slice(1)],
    investments: [{ Name: 'Composable commerce', IsPrimary: true }],
  })
  const html = renderToString(<AgentPlatformPage page={edited} />)
  const text = textOf(html)
  assert.match(text, /Shopify Plus/) // stack tile (and chip / evidence)
  assert.match(text, /13\.5K employees/) // the hero pill, formatted as the page formats it
  assert.ok(!/12K employees/.test(text))
  assert.match(text, /Composable commerce/)
  assert.ok(!/Global content localization/.test(text), 'the old investment is still shown')
  // N2/N3 still hold on live values: a competitor or a stakeholder name never shows.
  const leak = renderToString(<AgentPlatformPage page={mergeLive(base, { investments: [{ Name: 'AEM upgrade led by Pat Example', IsPrimary: true }] })} />)
  assert.ok(!/AEM upgrade|Pat Example/.test(textOf(leak)))
})

test('after the save, Edit mode replays the parts whose saved value differs from what the page shows', () => {
  const shown = { intelStats: [{ Value: '1', Label: 'a' }, { Value: '2', Label: 'visitors' }], techStack: [{ Name: 'X', ColorTag: null }], headline: 'h' }
  const saved = { intelStats: [{ Value: '1', Label: 'a' }], techStack: [{ Name: 'X', ColorTag: null }], headline: 'changed' }
  assert.deepEqual(changedLiveFields(['intelStats', 'techStack'], shown, saved), ['intelStats'])
  // Only fields the page can show live; a takeout field never replays.
  assert.deepEqual(changedLiveFields(['headline'], shown, saved), [])
})

test('the live store checks each value\'s shape and starts empty for the server', () => {
  assert.equal(liveValue('techStack', [{ Name: 'X', ColorTag: null }]) !== null, true)
  assert.equal(liveValue('techStack', 'Shopify'), null)
  assert.equal(liveValue('intelStats', [{ Value: 3, Label: 'x' }]), null)
  assert.equal(liveValue('footerTagline', 'Hello'), 'Hello')
  assert.equal(applyLiveField('headline', 'Takeout field'), false, 'a field this template does not show')
  assert.equal(applyLiveField('techStack', { Name: 'not an array' }), false)
  assert.equal(applyLiveField('footerLegal', 'Edited'), true)
  resetLive()
  // The server render never sees a live edit (useSyncExternalStore's server snapshot is empty).
  assert.ok(!renderToString(<AgentPlatformPage page={stackPage()} />).includes('Edited'))
})

/* -------------------------------------------------------------------- result */

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) {
  console.log(failures.map((f) => `  - ${f}`).join('\n'))
  process.exit(1)
}
