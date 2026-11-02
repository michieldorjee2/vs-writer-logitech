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
 */
import assert from 'node:assert/strict'
import { renderToString } from 'react-dom/server'
import type { CompetitorComparisonPage } from '../../lib/graph-types'
import AccountPage from '../AccountPage'
import OfferPage from '../OfferPage'
import { ACCOUNT_FIELDS } from '../account-fields'
import { comparisonTableHtml, formatStatValue, PROOF_LOGOS, realContacts } from '../account-helpers'
import { isOfferExperience, wantsWwwDesign } from '../design'
import { OFFER_SLOTS, readOffer, type ElementData } from '../offer-content'
import { plain, richToStacked } from '../ui'
import { ABM_XRAY_DEFAULTS } from '../../lib/xray-defaults'
import offerBlueprint from '../../cms/blueprints/offer'

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

test('wantsWwwDesign is ?design=www and nothing else', () => {
  assert.equal(wantsWwwDesign('?design=www'), true)
  assert.equal(wantsWwwDesign(new URLSearchParams('a=1&design=www')), true)
  assert.equal(wantsWwwDesign('?design=legacy'), false)
  assert.equal(wantsWwwDesign(''), false)
  assert.equal(wantsWwwDesign(null), false)
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
  modalScheduleUrl: ['href="https://example.test/F-modalScheduleUrl"'],
}
for (const f of ACCOUNT_FIELDS.filter((x) => x.use === 'attr')) {
  test(`attr  ${f.field} → ${f.section}`, () => {
    const want = ATTR_EXPECT[f.field]
    assert.ok(want, `no attribute expectation for ${f.field}: add one to ATTR_EXPECT`)
    for (const w of want) assert.ok(accountHtml.includes(w), `${w} is not in the markup`)
  })
}

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
  const sparse = { ...fullAccountPage(), painPoints: null, challengeHeadline: null, analystCards: null, analystHeadline: null, analystQuote: null, promoHeading: null }
  const html = renderToString(<AccountPage page={sparse as unknown as CompetitorComparisonPage} />)
  for (const id of ['challenge', 'analysts', 'promo']) assert.ok(!html.includes(`id="${id}"`), `#${id} rendered empty`)
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

test('the new account page carries a data-xray hook for every x-ray section', () => {
  const missing = ABM_XRAY_DEFAULTS.filter((s) => !accountHtml.includes(`data-xray="${s.id}"`)).map((s) => s.id)
  assert.deepEqual(missing, [])
})

/* -------------------------------------------------------------------- result */

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) {
  console.log(failures.map((f) => `  - ${f}`).join('\n'))
  process.exit(1)
}
