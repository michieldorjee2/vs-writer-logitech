/**
 * Tests for the www-design pages (src/www). Run with:
 *
 *   npm run check:www
 *
 * No network, no credentials, no test runner: scripts/check-www.mjs bundles this file with
 * esbuild (it is TSX importing TSX and the vendored optimizely.com components) and runs it with
 * node.
 *
 * What it proves:
 *   1. the pure helpers (stat formatting, the comparison table, heading conversion, offer
 *      detection, which template a page's pitch calls for)
 *   2. readOffer() reads a Visual Builder composition back into the offer blueprint's keys,
 *      including pages that leave a feed out, legacy section names, unknown sections
 *   3. OFFER_SLOTS is the offer blueprint (src/cms/blueprints/offer.ts), feed for feed
 *   4. NOTHING IS LOST: an account page with all 67 properties filled renders every stored
 *      value, and an offer page renders every string of every element in its composition
 *   5. X-ray and Edit mode can find every section: each ABM_XRAY_DEFAULTS id has a
 *      `data-xray` hook on the new page and every selector matches it
 *   6. the agent platform template (account pages that pitch it): the adapter that re-reads
 *      existing pages into it, Laura's rules (N1 to N14, gate 2), the lifecycle states, and that
 *      every stored field is either used or deliberately not shown
 *   7. the CMS preview: /api/preview serves a draft as the live address would, and in the CMS
 *      editor the pages carry the SDK's on-page editing hooks (and nowhere else)
 *   8. the person page (src/www/PersonPage.tsx): every stored field shown or deliberately not,
 *      nothing from Salesforce on the page, one ask, its X-ray and Edit hooks, its CMS preview
 *   9. the CTA ping: the browser sends only the page and button, the server reads the team itself
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { renderToString } from 'react-dom/server'
import type { CompetitorComparisonPage, PersonPage as PersonPageData } from '../../lib/graph-types'
import AccountPage, { connectProps } from '../AccountPage'
import OfferPage from '../OfferPage'
import { ACCOUNT_FIELDS, ACCOUNT_PAGE_PROPERTIES } from '../account-fields'
import { comparisonTableHtml, formatStatValue, PROOF_LOGOS, realContacts } from '../account-helpers'
import { isOfferExperience } from '../design'
import { nodeKeyOf, OFFER_SLOTS, readOffer, type ElementData } from '../offer-content'
import { fitVars, plain, richToStacked } from '../ui'
import { hasOwnLogo, parentAccountUrls, pickParentAccount, salesforceIds } from '../../lib/parent-account'
import { forgetParentAccounts, parentAccountsOf, parentKey, withParentAccount } from '../../../api/_lib/parent-account'
import { forgetOfferPages, offerPagesByOffer } from '../../../api/_lib/offer-pages'
import { withPages } from '../../../api/_lib/offers'
import { ABM_XRAY_DEFAULTS, ABM_XRAY_LEGACY_IDS, AGENT_PLATFORM_EDIT, AGENT_PLATFORM_XRAY, PERSON_EDIT, PERSON_XRAY_DEFAULTS, TAKEOUT_EDIT } from '../../lib/xray-defaults'
import { buildSuggestedEdit, AGENT_PLATFORM_TEMPLATE_LINE } from '../../lib/edit-payload'
import { applyLiveField, changedLiveFields, getLivePatch, LIVE_FIELDS, liveFieldValue, liveValue, mergeLive, resetLive } from '../live-edit'
import { COPY_KEYS, COPY_THEMES, copyEdits, copyKey, copyValue, expandFields, readCopy } from '../../lib/page-copy'
import { resolveCopy, templateCopy } from '../agent-platform/copy'
import { readPageCopy, savePageCopy, useCopyStore, withPageCopy, type CopyStore } from '../../../api/_lib/page-copy'
import opalEditStream from '../../../api/opal-edit-stream'
import AgentPlatformPage from '../AgentPlatformPage'
import offerBlueprint from '../../cms/blueprints/offer'
import AccountRoute from '../AccountRoute'
import { accountTemplateOf } from '../account-template'
import { CmsEditProvider } from '../cms-edit'
import { inCmsPreview } from '../../lib/cms-preview'
import { postSignup } from '../../lib/offer-signup'
import { sendCtaPing } from '../../lib/cta-ping'
import PersonPage, { personConnectProps } from '../PersonPage'
import { PERSON_FIELDS, askLabelOf, bookingUrlOf, formatDate, keyNumberText, measuresOf, peerProofOf, publicPersonPage } from '../person-content'
import { accountExecutiveOf, toldFirstName } from '../../lib/account-rep'
import ctaPingHandler, { accountSource, buildPing, canonicalJson, checkOf, personSource, pingRouteOf, type CtaPing } from '../../../api/cta-ping'
import previewHandler, { concreteType } from '../../../api/preview'
import { agentPlatformHead, competitorMatcher, deriveState, fromLegacyPage, NOT_SHOWN, personMatcher, USED_FIELDS } from '../agent-platform/content'
import { readStack, stackTiles } from '../agent-platform/stack'
import { DEFAULT_TEAMS, IDENTITY_SENTENCE, THEME_ORDER, WHO_WE_ARE } from '../agent-platform/library'

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

/** An async test: queued, and run in order after the synchronous ones (the bundle is CommonJS, no top-level await). */
const later: Array<[string, () => Promise<void>]> = []
function testAsync(name: string, fn: () => Promise<void>) {
  later.push([name, fn])
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
    if (f.field === 'stakeholders') values = ['F-stakeholder-name', 'F-stakeholder-role'] // never the engagement badge or note: see below
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

test('the offer headline is sized to its length: a long one steps down, a short one keeps the display size', () => {
  // Laura, 3 Nov: a long headline ran to seven lines and pushed the hero past the window.
  const short = 'Optimizely at ##6sense Breakthrough##' // 33 characters, the shortest live offer headline
  const long = 'Sitecore is slowing down sites for more than 100 markets. ##Take a day back.##' // 74, the longest
  const w = (t: string) => Number((fitVars(t) as Record<string, string>)['--fit-w'])
  const h = (t: string) => Number((fitVars(t) as Record<string, string>)['--fit-h'])
  assert.ok(w(long) < w(short) && h(long) < h(short), 'a longer headline must get a smaller size')
  assert.ok(Math.abs(w(long) / w(short) - Math.sqrt(33 / 74)) < 0.01, 'the size goes as 1/√length')
  assert.equal(w(plain(short)), w(short), 'the ## marks do not count as characters')
  // The offer hero opts in; the size class and the length's variables reach the h1.
  const hero = offerHtml.match(/<section id="hero"[\s\S]*?<\/section>/)?.[0] ?? ''
  assert.match(hero, /<h1[^>]*class="[^"]*www-display--fit/)
  assert.ok(hero.includes(`--fit-w:${(fitVars('O-headline ##O-run##') as Record<string, string>)['--fit-w']}`), 'the fit variables are not on the headline')
  // The account page's headline is template copy and keeps its fixed size.
  assert.ok(!renderToString(<AgentPlatformPage page={account} />).includes('www-display--fit'))
})

test('the offer intro is one column on the content width, not two', () => {
  // Laura, 3 Nov: the two columns left a single paragraph alone in the left half.
  const intro = offerHtml.match(/<section id="intro"[\s\S]*?<\/section>/)?.[0] ?? ''
  assert.match(intro, /class="www-intro"/)
  assert.ok(!/max-w-\[1000px\]/.test(intro), 'the intro is still a narrow centred block')
  const css = readFileSync('src/www/www.css', 'utf8')
  const introRules = [...css.matchAll(/([^{}]*\.www-intro[^{}]*)\{([^}]*)\}/g)].map((m) => m[2])
  assert.ok(introRules.length > 0, 'no .www-intro rules found')
  assert.ok(introRules.every((body) => !/\bcolumns\s*:/.test(body)), 'an intro rule still sets columns')
})

test('offer page: scenes on the same background share it instead of each padding out to 75% (offer pages only)', () => {
  // Laura, 3 Nov. The account pages keep every scene at 75% (Michiel, 2 Nov).
  assert.match(offerHtml, /class="www-page [^"]*www-offer/)
  assert.ok(!accountHtml.includes('www-offer'))
  const css = readFileSync('src/www/www.css', 'utf8')
  assert.match(css, /\.www-offer \.www-scene\.www-scene--light \+ \.www-scene\.www-scene--light[\s\S]*?min-height: 0/)
})

test('booth chrome on a www page is solid, with no backdrop blur (it flickered while scrolling)', () => {
  // Michiel, 3 Nov: "flickering for the admin sidebar when scrolling".
  // X-ray has no bar since 6 Nov (its status is in the rail); its cards and note are solid.
  const xray = readFileSync('src/styles/xray-mode.css', 'utf8')
  assert.ok(!/\.xray-hud\b/.test(xray), 'X-ray has a bar again')
  assert.ok(!/backdrop-filter/.test(xray), 'X-ray blurs what is behind it')
  // Edit mode has no bar since 6 Nov (its controls are in the rail); its hint, popup and status are solid.
  const edit = readFileSync('src/styles/edit-mode.css', 'utf8')
  assert.ok(!/\.edit-hud\b/.test(edit), 'Edit mode has a bar again')
  for (const sel of ['.edit-hint', '.edit-popup', '.live-hud']) {
    const body = edit.match(new RegExp(`\\${sel} \\{([^}]*)\\}`))?.[1] ?? ''
    assert.ok(body && !/backdrop-filter/.test(body), `${sel} blurs what is behind it`)
  }
  // The rail (4 Nov) is an opaque surface from the start: no blur anywhere in it.
  const rail = readFileSync('src/styles/booth-rail.css', 'utf8')
  assert.ok(!/backdrop-filter/.test(rail), 'the rail blurs what is behind it')
  assert.match(rail, /\.booth-rail \{[^}]*background: var\(--booth-page\)/)
})

test('every X-ray part says in one short line how it is made', () => {
  // Michiel, 6 Nov: the card shows "what logic goes into that section vs just what data was used".
  for (const part of [...ABM_XRAY_DEFAULTS, ...PERSON_XRAY_DEFAULTS]) {
    assert.ok(part.logic && part.logic.length <= 120, `${part.id}: ${part.logic ?? 'no logic line'}`)
    assert.notEqual(part.logic, part.sources.join(', '), `${part.id} repeats its data`)
  }
})

test('a comment badge pops from its own centre and moves with its box', () => {
  // Michiel, 6 Nov: the little "1" "jumps all over". An SVG element scales from the document's
  // corner unless told otherwise, and the badge was placed once while its box kept moving.
  const css = readFileSync('src/styles/edit-mode.css', 'utf8')
  const badge = css.match(/\.edit-box__badge \{([^}]*)\}/)?.[1] ?? ''
  assert.match(badge, /transform-box: fill-box/)
  const src = readFileSync('src/components/EditMode.tsx', 'utf8')
  assert.match(src, /badgeRefs\.current\.get\(e\.section\.id\)\?\.setAttribute\('transform', badgeAt\(o\)\)/)
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

test('the request to Mark carries the text a copy field shows now', () => {
  const ap = buildSuggestedEdit(
    [{ title: 'Headline', feedback: 'Mention their beer brands', fields: ['copy.hero.h1'], copy: { 'copy.hero.h1': 'You already run Optimizely. Now put ##agents to work## on it.' } }],
    'agent-platform',
  )
  assert.ok(ap.includes('Fields: copy.hero.h1'))
  assert.ok(ap.includes('Now:\n  copy.hero.h1 = "You already run Optimizely. Now put ##agents to work## on it."'))
  assert.ok(AGENT_PLATFORM_TEMPLATE_LINE.includes('copy.') && /update_page/.test(AGENT_PLATFORM_TEMPLATE_LINE))
})

/** A page-copy store in memory, for withPageCopy and the stream route. */
function memoryStore(): CopyStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>()
  return {
    data,
    get: (async (k: string) => (data.has(k) ? JSON.parse(JSON.stringify(data.get(k))) : null)) as CopyStore['get'],
    set: (async (k: string, v: unknown) => {
      data.set(k, JSON.parse(JSON.stringify(v)))
      return 'OK'
    }) as CopyStore['set'],
  }
}

testAsync('page copy is kept per page and added to the account page wherever it is served', async () => {
  const store = memoryStore()
  useCopyStore(store)
  try {
    assert.deepEqual(await savePageCopy('/heineken/', { 'hero.h1': 'One', 'hero.eyebrow': 'no' } as never, 'pat@optimizely.com'), { 'hero.h1': 'One' })
    await savePageCopy('heineken', { 'close.line': 'Two' }, 'sam@optimizely.com')
    assert.deepEqual(await readPageCopy('/en/heineken/'), { 'hero.h1': 'One', 'close.line': 'Two' })
    const saved = store.data.get('pc:heineken') as { edits: Array<{ key: string; by: string }> }
    assert.deepEqual(saved.edits.map((e) => `${e.key} ${e.by}`), ['close.line sam@optimizely.com', 'hero.h1 pat@optimizely.com'])
    const page = { __typename: 'CompetitorComparisonPage', _metadata: { url: { hierarchical: '/heineken/' } } }
    assert.deepEqual(((await withPageCopy(page)) as { pageCopy?: unknown }).pageCopy, { 'hero.h1': 'One', 'close.line': 'Two' })
    const other = { _metadata: { url: { hierarchical: '/cdw/' } } }
    assert.equal(await withPageCopy(other), other, 'a page with no copy of its own is not the same object')
    // A store that fails or hangs never fails the page.
    useCopyStore({ get: (async () => { throw new Error('down') }) as CopyStore['get'], set: store.set })
    assert.equal(await withPageCopy(page), page)
    useCopyStore({ get: (() => new Promise(() => {})) as CopyStore['get'], set: store.set })
    assert.equal(await withPageCopy(page), page)
  } finally {
    useCopyStore(undefined)
  }
})

testAsync('the edit stream saves the copy edits Mark applied, as the signed-in editor, and says so', async () => {
  const store = memoryStore()
  useCopyStore(store)
  const env = { ...process.env }
  delete process.env.OPTIID_RELAY_SECRET
  process.env.DEV_AUTH_EMAIL = 'editor@optimizely.com'
  process.env.OPAL_PAT = 'test-pat'
  delete process.env.VERCEL_TOKEN
  const realFetch = globalThis.fetch
  const asked: string[] = []
  // Mark's stream: the headline edit split across two chunks, a skipped edit, a CMS field, done.
  const chunks = [
    '{"type":"section_focus","section":"Headline"}{"type":"edit","section":"Headline","field":"copy.hero.h1","value":"Heineken, meet ',
    '##your agents##.","status":"applied"}{"type":"edit","section":"Close","field":"copy.close.line","value":"No","status":"skipped"}',
    '{"type":"edit","section":"Account facts","field":"intelStats","value":[]}{"type":"done","saved":true}',
  ]
  globalThis.fetch = (async (url: unknown) => {
    asked.push(String(url))
    const body = chunks.map((c) => `data: ${JSON.stringify({ event_type: 'response_chunk', payload: { content: c } })}\n\n`).join('')
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
  }) as typeof fetch
  const written: string[] = []
  const req = { method: 'POST', cookies: {}, headers: {}, on: () => {}, body: { company_name: 'Heineken', company_slug: '/heineken', suggested_edit: 'Section: Headline', page_key: 'a'.repeat(32) } }
  const res = {
    statusCode: 200,
    setHeader: () => {},
    // A Vercel response has it: signing someone in may add a cookie beside another (the staff mark).
    getHeader: () => undefined,
    status(c: number) { this.statusCode = c; return this },
    json(b: unknown) { written.push(JSON.stringify(b)); return this },
    write(chunk: string) { written.push(chunk); return true },
    end() {},
  }
  try {
    await opalEditStream(req as never, res as never)
    assert.equal(asked.length, 1, 'the route called something besides the agent')
    assert.ok(asked[0].includes('/stream-execute'))
    const saved = store.data.get('pc:heineken') as { values: Record<string, unknown>; edits: Array<{ by: string }> }
    assert.deepEqual(saved?.values, { 'hero.h1': 'Heineken, meet ##your agents##.' })
    assert.equal(saved.edits[0].by, 'editor@optimizely.com')
    const msgs = written.filter((w) => w.startsWith('data:')).map((w) => JSON.parse(w.slice(5)))
    const copy = msgs.find((m) => m.k === 'copy')
    assert.deepEqual(copy, { k: 'copy', saved: ['hero.h1'] })
    assert.equal(msgs.at(-1).k, 'done')
    assert.ok(msgs.findIndex((m) => m.k === 'copy') < msgs.length - 1, 'copy comes before done')
  } finally {
    globalThis.fetch = realFetch
    process.env = env
    useCopyStore(undefined)
  }
})

console.log('\noffer page: the parent account (its logo)')

test('the parent account page is looked up at the company name as a slug, best first', () => {
  assert.deepEqual(parentAccountUrls('Ralph Lauren Corp.'), ['/ralph-lauren-corp/', '/ralph-lauren/'])
  assert.deepEqual(parentAccountUrls('OpenTable'), ['/opentable/', '/open-table/'])
  assert.deepEqual(parentAccountUrls('Wiz, Inc.'), ['/wiz-inc/', '/wiz/'])
  assert.deepEqual(parentAccountUrls('Ziff Davis, LLC.'), ['/ziff-davis-llc/', '/ziff-davis/'])
  // A regional office or a division: the account's name, then only qualifier words.
  assert.deepEqual(parentAccountUrls('Microsoft Australia'), ['/microsoft-australia/', '/microsoft/'])
  assert.deepEqual(parentAccountUrls('Tata Consultancy Services UK Limited').slice(-2), ['/tata-consultancy-services/', '/tata-consultancy/'])
  assert.ok(parentAccountUrls('Cisco Systems, Inc.').includes('/cisco/'))
  // ...but not a name that only starts the same.
  assert.deepEqual(parentAccountUrls('BILL'), ['/bill/'])
  assert.ok(!parentAccountUrls('Bill Payments Platform').includes('/bill/'))
  assert.ok(!parentAccountUrls('Microsoft Game Stack').includes('/microsoft/'))
  assert.deepEqual(parentAccountUrls('Alvarez & Marsal'), ['/alvarez-and-marsal/'])
  assert.deepEqual(parentAccountUrls('Volvo Cars'), ['/volvo-cars/'])
  assert.deepEqual(parentAccountUrls('  '), [])
  assert.deepEqual(parentAccountUrls(null), [])
})

test('of several account pages, the one at the best URL is the parent; none, no parent', () => {
  const urls = parentAccountUrls('SAP SE')
  const found = [
    { url: '/sap/', logo: 'https://cdn.example.test/sap-short.svg', domain: 'sap.com' },
    { url: '/sap-se/', logo: 'https://cdn.example.test/sap.svg', domain: 'sap.com' },
  ]
  assert.equal(pickParentAccount(urls, found)?.url, '/sap-se/')
  assert.equal(pickParentAccount(urls, []), null)
  assert.equal(pickParentAccount(urls, [{ url: '/sapient/', logo: null, domain: null }]), null)
})

test('the Salesforce account is the first link to the parent; a placeholder ID of zeros is none', () => {
  assert.deepEqual(salesforceIds('0014J00000MyXyTQAV'), ['0014J00000MyXyTQAV', '0014J00000MyXyT'])
  assert.deepEqual(salesforceIds('000000000000000AAA'), [])
  assert.deepEqual(salesforceIds('000000000000000'), [])
  assert.deepEqual(salesforceIds(''), [])
  assert.deepEqual(salesforceIds(null), [])
  assert.deepEqual(salesforceIds('not an id'), [])
  // The page with the offer's account wins over the page at the company's name...
  const urls = parentAccountUrls('Acme Inc.')
  const byName = { url: '/acme/', logo: 'https://example.test/name.svg', domain: 'acme.com', salesforceAccountID: '0014J00000AAAAAQAA' }
  const byId = { url: '/acme-group/', logo: 'https://example.test/id.svg', domain: 'acme.com', salesforceAccountID: '0014J00000BBBBBQAB' }
  assert.equal(pickParentAccount(urls, [byName, byId], salesforceIds('0014J00000BBBBB'))?.url, '/acme-group/')
  // ...and with no ID match, the name decides.
  assert.equal(pickParentAccount(urls, [byName, byId], salesforceIds('0014J00000CCCCCQAC'))?.url, '/acme/')
})

test('a placeholder image is not a logo of the page\'s own', () => {
  assert.equal(hasOwnLogo('https://placehold.co/96x96?text=AC'), false)
  assert.equal(hasOwnLogo(null), false)
  assert.equal(hasOwnLogo(''), false)
  assert.equal(hasOwnLogo('https://cdn.brandfetch.io/domain/acme.com/type/icon'), true)
})

/** withParentAccount against a stand-in for Graph: nothing leaves the process. */
async function withGraph<T>(answer: (urls: string[]) => Response | Promise<Response>, run: (asked: string[][]) => Promise<T>): Promise<T> {
  const realFetch = globalThis.fetch
  const realKey = process.env.GRAPH_AUTH_KEY
  const asked: string[][] = []
  process.env.GRAPH_AUTH_KEY = 'test-key'
  globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
    const urls = JSON.parse(init?.body ?? '{}').variables?.urls ?? []
    asked.push(urls)
    return answer(urls)
  }) as typeof fetch
  forgetParentAccounts()
  try {
    return await run(asked)
  } finally {
    globalThis.fetch = realFetch
    if (realKey === undefined) delete process.env.GRAPH_AUTH_KEY
    else process.env.GRAPH_AUTH_KEY = realKey
    forgetParentAccounts()
  }
}
const graphAnswer = (items: unknown[]) => new Response(JSON.stringify({ data: { CompetitorComparisonPage: { items } } }), { status: 200 })
const RL_LOGO = 'https://cdn.brandfetch.io/domain/ralphlauren.com/type/icon'

testAsync('an offer page without a logo shows its parent account\'s, and its domain', async () => {
  await withGraph(
    () => graphAnswer([{ _metadata: { url: { hierarchical: '/ralph-lauren/' } }, customerLogo: RL_LOGO, brandDomain: 'ralphlauren.com' }]),
    async (asked) => {
      const page = { __typename: 'ABMExperience', companyName: 'Ralph Lauren Corp.', customerLogo: { default: null }, brandDomain: null }
      const shown = (await withParentAccount(page)) as typeof page & { parentAccountUrl?: string }
      assert.deepEqual(asked, [['/ralph-lauren-corp/', '/ralph-lauren/']])
      assert.equal(shown.customerLogo.default, RL_LOGO)
      assert.equal(shown.brandDomain, 'ralphlauren.com')
      assert.equal(shown.parentAccountUrl, '/ralph-lauren/')
      // ...and the hero draws it, above the headline, in place of the initials.
      const html = renderToString(<OfferPage experience={{ ...fullOffer(), companyName: shown.companyName, customerLogo: shown.customerLogo }} />)
      assert.ok(html.includes(`src="${RL_LOGO}"`), 'the hero does not draw the inherited logo')
      // Asked once per company: the next page for the same company is answered from what was held.
      await withParentAccount(page)
      assert.equal(asked.length, 1)
    },
  )
})

testAsync('a page with its own logo keeps it; other experiences, no parent, or Graph failing: the page as it was', async () => {
  const own = { __typename: 'ABMExperience', companyName: 'Ralph Lauren Corp.', customerLogo: { default: 'https://example.test/own.svg' }, brandDomain: 'ralphlauren.com' }
  const person = { __typename: 'PersonExperience', companyName: 'Ralph Lauren Corp.', customerLogo: { default: null } }
  const bare = { __typename: 'ABMExperience', companyName: 'Dynatrace', customerLogo: { default: null }, brandDomain: null }
  await withGraph(
    () => graphAnswer([]),
    async (asked) => {
      assert.equal(await withParentAccount(own), own)
      assert.equal(await withParentAccount(person), person)
      assert.equal(asked.length, 0, 'asked Graph for a page that needs nothing')
      assert.equal(await withParentAccount(bare), bare)
      assert.equal(asked.length, 1)
    },
  )
  await withGraph(
    () => new Response('nope', { status: 502 }),
    async () => assert.equal(await withParentAccount(bare), bare),
  )
  await withGraph(
    () => Promise.reject(new Error('network down')),
    async () => assert.equal(await withParentAccount(bare), bare),
  )
})

testAsync('the search page lists each offer page with its parent account\'s logo, looked up in batches', async () => {
  // Graph stand-in: the offer pages, then the account pages at the URLs and Salesforce IDs asked.
  const ACCOUNTS = [
    { _metadata: { url: { hierarchical: '/ralph-lauren/' } }, salesforceAccountID: null, customerLogo: RL_LOGO, brandDomain: 'ralphlauren.com' },
    { _metadata: { url: { hierarchical: '/microsoft/' } }, salesforceAccountID: null, customerLogo: 'https://cdn.example.test/ms.svg', brandDomain: 'microsoft.com' },
    { _metadata: { url: { hierarchical: '/open-table/' } }, salesforceAccountID: '0014J00000bNAH3QAO', customerLogo: 'https://cdn.example.test/ot.svg', brandDomain: 'opentable.com' },
  ]
  const plan = JSON.stringify({ kind: 'offer-page', offerId: 'lab' })
  const OFFERS = [
    { _metadata: { url: { hierarchical: '/lab-ralph-lauren-corp/' }, published: '2026-11-03' }, companyName: 'Ralph Lauren Corp.', salesforceAccountID: null, brandDomain: null, customerLogo: { default: null }, componentPlan: plan },
    { _metadata: { url: { hierarchical: '/lab-microsoft-australia/' }, published: '2026-11-02' }, companyName: 'Microsoft Australia', salesforceAccountID: null, brandDomain: null, customerLogo: { default: 'https://placehold.co/96' }, componentPlan: plan },
    { _metadata: { url: { hierarchical: '/lab-ot/' }, published: '2026-11-01' }, companyName: 'OT Group Holdings', salesforceAccountID: '0014J00000bNAH3QAO', brandDomain: null, customerLogo: { default: null }, componentPlan: plan },
    { _metadata: { url: { hierarchical: '/lab-dynatrace/' }, published: '2026-10-31' }, companyName: 'Dynatrace', salesforceAccountID: null, brandDomain: null, customerLogo: { default: null }, componentPlan: plan },
    { _metadata: { url: { hierarchical: '/lab-own/' }, published: '2026-10-30' }, companyName: 'Own Logo Inc.', salesforceAccountID: null, brandDomain: 'own.test', customerLogo: { default: 'https://cdn.example.test/own.svg' }, componentPlan: plan },
  ]
  const parentQueries: Array<{ urls: string[]; sf: string[] }> = []
  await withGraph(
    () => graphAnswer([]),
    async () => {
      globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
        const b = JSON.parse(init?.body ?? '{}')
        if (/query OfferPages/.test(b.query)) return new Response(JSON.stringify({ data: { ABMExperience: { total: OFFERS.length, items: OFFERS } } }), { status: 200 })
        const urls: string[] = b.variables?.urls ?? []
        const sf: string[] = b.variables?.sf ?? []
        parentQueries.push({ urls, sf })
        const items = ACCOUNTS.filter((a) => urls.includes(a._metadata.url.hierarchical) || (a.salesforceAccountID && sf.includes(a.salesforceAccountID)))
        return graphAnswer(items)
      }) as typeof fetch
      forgetOfferPages()
      const graph = await offerPagesByOffer()
      const pages = graph.get('lab') ?? []
      // Each page is listed at the address it is served at (/vb/<slug>), not the bare CMS path.
      assert.ok(pages.length === 5 && pages.every((p) => p.route.startsWith('vb/lab-')), pages.map((p) => p.route).join(', '))
      const logo = (route: string) => pages.find((p) => p.route === `vb/${route}`)?.logoUrl
      assert.equal(logo('lab-ralph-lauren-corp'), RL_LOGO, 'by the company name')
      assert.equal(logo('lab-microsoft-australia'), 'https://cdn.example.test/ms.svg', 'a regional office, over a placeholder image')
      assert.equal(logo('lab-ot'), 'https://cdn.example.test/ot.svg', 'by the Salesforce account')
      assert.equal(pages.find((p) => p.route === 'vb/lab-ot')?.domain, 'opentable.com')
      assert.equal(logo('lab-dynatrace'), null, 'no account page: no logo, the initials')
      assert.equal(logo('lab-own'), 'https://cdn.example.test/own.svg', 'its own logo kept')
      // Aldus UI's page log names the same pages as /vb/ URLs: merged, each company once.
      const offer = withPages(
        { id: 'lab', title: 'Lab', windowStart: null, windowEnd: null, look: null, fromSearch: 'off', pages: [
          { pageUrl: 'https://showcase.optimizely.com/vb/lab-ralph-lauren-corp', accountName: 'Ralph Lauren Corp.', liveSince: '2026-11-03' },
          { pageUrl: '/vb/lab-new-co', accountName: 'New Co', liveSince: '2026-11-04' },
        ] } as never,
        graph,
      )
      assert.equal(offer.pages.length, 6, offer.pages.map((p) => p.route).join(', '))
      assert.equal(offer.pages.filter((p) => p.companyName === 'Ralph Lauren Corp.').length, 1, 'Ralph Lauren listed twice')
      // One batched query for the four pages without a logo, not one each; the page with its own logo isn't asked about.
      assert.equal(parentQueries.length, 1, `${parentQueries.length} parent queries`)
      assert.ok(!parentQueries[0].urls.some((u) => u.startsWith('/own-logo')), 'asked about a page with its own logo')
      // Held: asked again, nothing new is queried.
      await parentAccountsOf([{ companyName: 'Ralph Lauren Corp.' }])
      assert.equal(parentQueries.length, 1)
      assert.equal((await parentAccountsOf([{ companyName: 'Dynatrace' }])).get(parentKey('Dynatrace')), null)
    },
  )
  forgetOfferPages()
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

const apSearch = (s: string) => renderToString(<AgentPlatformPage page={stackPage({ intelStats: stackPage().intelStats?.filter((x) => !/Optimizely/.test(x.Label)) })} search={s} />)
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

test('the page\'s own pitch picks its template: the agent platform when it sells that, its own pitch otherwise', () => {
  const ids = (html: string) => [...html.matchAll(/<section id="([^"]+)" data-scene/g)].map((m) => m[1])
  const AP = ['hero', 'who', 'intel', 'language', 'usecases', 'proof', 'migration', 'cta']
  const TAKEOUT = ['hero', 'intel', 'signals', 'challenge', 'comparison', 'proof', 'analysts', 'promo', 'roi', 'migration', 'cta']
  // Headlines from the live pages (4 Nov), one per pitch the builder writes.
  const pitched = (headline: string, subheadline = 'F-subheadline') => ({ ...fullAccountPage(), headline, subheadline }) as CompetitorComparisonPage
  for (const h of ['Marketing agents for Smartsheet, Inc.', "Agents for ACHE's content team", 'Agents built for Jefferies marketing'])
    assert.equal(accountTemplateOf(pitched(h)), 'agent-platform', h)
  assert.equal(accountTemplateOf(pitched("Scale Mace Construct's new brand", 'Optimizely Agent Platform keeps every page on brand.')), 'agent-platform')
  for (const h of ['Relief for RINA S.p.A.', 'Prove every Lenovo launch', 'Test everything Atlassian ships', 'Limitless for Google Cloud', 'Relief for Core-Mark', 'One platform for <em>Tungsten</em>'])
    assert.equal(accountTemplateOf(pitched(h)), 'takeout', h)
  assert.deepEqual(ids(renderToString(<AccountRoute page={pitched('Marketing agents for Smartsheet, Inc.')} />)), AP)
  assert.deepEqual(ids(renderToString(<AccountRoute page={pitched('Relief for RINA S.p.A.')} />)), TAKEOUT)
  // No address picks it: the old switches change nothing.
  for (const q of ['?template=takeout', '?design=classic', '?design=www'])
    assert.equal(renderToString(<AccountRoute page={pitched('Relief for RINA S.p.A.')} search={q} />), renderToString(<AccountRoute page={pitched('Relief for RINA S.p.A.')} />), q)
  // The router, the server render and the CMS preview all draw through AccountRoute, never a renderer of their own.
  for (const f of ['src/App.tsx', 'server/ssr-handler.tsx', 'src/components/CmsPreview.tsx']) {
    const src = readFileSync(f, 'utf8')
    assert.ok(/AccountRoute/.test(src), `${f} does not draw through AccountRoute`)
    for (const gone of ['ABMHyperPage', 'DynamicComparisonPage', 'UseCasePage', 'wantsWwwDesign', 'wantsTakeout'])
      assert.ok(!new RegExp(`\\b${gone}\\b`).test(src), `${f} still names ${gone}`)
  }
})

test('Google Cloud leaves "Who we are" out (Dan Tranter, 3 Nov); every other page keeps it', () => {
  const ids = (html: string) => [...html.matchAll(/<section id="([^"]+)" data-scene/g)].map((m) => m[1])
  const base = stackPage()
  const google = renderToString(
    <AgentPlatformPage page={stackPage({ _metadata: { ...base._metadata, key: '21e18f692d104227b794faadb17b2331', url: { default: '/google/', hierarchical: '/en/google/' } } })} search="" />,
  )
  assert.deepEqual(ids(google), ['hero', 'intel', 'language', 'usecases', 'proof', 'migration', 'cta'])
  assert.ok(!textOf(google).includes(WHO_WE_ARE.heading), 'the platform overview heading is still on the Google page')
  assert.ok(!/data-xray="who-we-are"/.test(google))
  assert.ok(textOf(apHtml).includes(WHO_WE_ARE.heading), 'another page lost "Who we are"')
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
    assert.match(hero, /class="www-account__logo"[^>]*><img src="https:\/\/example\.test\/F-customerLogo\.png"/)
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
  const html = renderToString(<AgentPlatformPage page={stackPage({ intelStats: facts })} search="" />)
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
  const html = renderToString(<AgentPlatformPage page={stackPage({ competitorName: 'DynamicWeb', techStack: tools.map((t) => ({ Name: t.name, ColorTag: null })) })} search="" />)
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

test('the 90 days: each step draws a line out of its number, not a bar on the card edge', () => {
  // Michiel, 3 Nov: the bar along each card's top edge "looks a little weird".
  const path = apHtml.match(/<ol class="www-path[\s\S]*?<\/ol>/)?.[0] ?? ''
  const steps = path.match(/www-path__step/g) ?? []
  assert.equal(steps.length, 4, 'four steps')
  assert.equal((path.match(/class="www-path__rule"/g) ?? []).length, 4, 'every step has its line')
  assert.match(path, /class="www-step-n">1<\/span><span class="www-path__rule"/, 'the line runs out of the number')
  const css = readFileSync('src/www/www.css', 'utf8')
  assert.ok(!css.includes('.www-path__step::before'), 'the edge bar is still drawn')
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
    <AgentPlatformPage
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
  assert.deepEqual(ABM_XRAY_LEGACY_IDS.filter((id) => !accountHtml.includes(`data-xray="${id}"`)), [])
})

test('the one-click ask: buttons, no form anywhere on the page', () => {
  assert.ok(!/<form[\s>]/.test(apHtml))
  assert.match(apHtml, /id="hero-connect-btn"/)
  assert.match(apHtml, /id="sticky-connect-btn"/)
  assert.match(apHtml, /id="cta-connect-btn"/)
})

console.log('\nEdit mode on the takeout page')

test('Edit mode offers every part of the takeout page, each with its fields and a hint, and each on the page', () => {
  const ids = TAKEOUT_EDIT.map((s) => s.id)
  assert.equal(new Set(ids).size, ids.length, 'a part is offered twice')
  assert.equal(new Set(TAKEOUT_EDIT.map((s) => s.title)).size, ids.length, 'two parts share a title (Mark matches by title)')
  assert.deepEqual(ids.filter((id) => !accountHtml.includes(`data-xray="${id}"`)), [], 'offered but not on the page')
  for (const s of TAKEOUT_EDIT) {
    assert.ok(s.hint.length > 12, `${s.id}: no hint`)
    assert.ok(s.fields.length > 0 && s.fields.every((f) => ACCOUNT_PAGE_PROPERTIES.includes(f)), `${s.id}: fields`)
  }
})

test('between them the takeout parts cover every stored field the page shows (nothing unmapped)', () => {
  const offered = new Set(TAKEOUT_EDIT.flatMap((s) => s.fields))
  const shown = ACCOUNT_FIELDS.filter((f) => f.use === 'text' || f.use === 'attr').map((f) => f.field)
  assert.deepEqual(shown.filter((f) => !offered.has(f)), [])
})

test('the request to Mark from a takeout page names each section\'s fields, with no template line', () => {
  const req = buildSuggestedEdit([{ title: 'Comparison headline', feedback: 'Name Sitecore XM Cloud', fields: ['comparisonHeadline', 'comparisonDescription', 'competitorName'] }], 'takeout')
  assert.equal(req, 'Section: Comparison headline\nFields: comparisonHeadline, comparisonDescription, competitorName\nFeedback: Name Sitecore XM Cloud')
  assert.ok(!req.includes(AGENT_PLATFORM_TEMPLATE_LINE))
})

test('a live edit re-renders the takeout page from Mark\'s value: text and lists, every place they show', () => {
  resetLive()
  assert.equal(applyLiveField('headline', 'Live headline for Acme'), true)
  assert.equal(applyLiveField('comparisonTableRows', [{ Category: 'Live capability', OurValue: 'Yes', CompetitorValue: 'No' }]), true)
  assert.equal(applyLiveField('comparisonTableRows', 'not rows'), false)
  assert.equal(applyLiveField('timelinePhases', [{ Title: 'Live phase', Description: 'Live step' }]), true)
  const shown = mergeLive(account, getLivePatch())
  const text = textOf(renderToString(<AccountPage page={shown as CompetitorComparisonPage} />))
  for (const t of ['Live headline for Acme', 'Live capability', 'Live phase']) assert.match(text, new RegExp(t))
  resetLive()
  // Each field a takeout part offers that a live edit may change has an element to flash.
  const NO_ELEMENT = new Set(['stickyCTAText', 'testimonial1JobTitle', 'testimonial1Company', 'testimonial2JobTitle', 'testimonial2Company', 'roiProjectionLabel', 'challengeScreenshotAlt', 'competitorName'])
  const flashable = TAKEOUT_EDIT.flatMap((s) => s.fields).filter((f) => (LIVE_FIELDS as readonly string[]).includes(f) && !NO_ELEMENT.has(f))
  assert.deepEqual(flashable.filter((f) => !accountHtml.includes(`data-field="${f}"`)), [])
})

test('Edit mode runs the takeout page the way it runs the agent platform page', () => {
  const src = readFileSync('src/components/EditMode.tsx', 'utf8')
  assert.match(src, /template === 'takeout'\s*\?\s*TAKEOUT_EDIT/)
  assert.match(src, /template === 'person'\s*\?\s*PERSON_EDIT/)
  // Live re-render reads account page fields: the person page is not live.
  assert.match(src, /const live = template === 'agent-platform' \|\| template === 'takeout'/)
  assert.match(src, /if \(live && ev\.field !== undefined && ev\.value !== undefined && applyLiveField/)
  assert.match(accountHtml, /class="www-page[^"]*\bwww-takeout\b/)
})

console.log('\nEdit mode on the agent platform page')

test('Edit mode offers the parts a page field drives and the page\'s own text, each on the page', () => {
  const hero = apHtml.slice(0, apHtml.indexOf('</section>'))
  const shown = templateCopy(fromLegacyPage(stackPage({ intelStats: stackPage().intelStats?.filter((x) => !/Optimizely/.test(x.Label)) })))
  const marked = new Set([...apHtml.matchAll(/data-field="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)))
  for (const sec of AGENT_PLATFORM_EDIT) {
    const hook = sec.selector.match(/data-xray="([^"]+)"/)?.[1]
    const prefix = sec.selector.match(/data-field\^?="([^"]+)"/)?.[1]
    if (hook) assert.ok((sec.selector.startsWith('#hero') ? hero : apHtml).includes(`data-xray="${hook}"`), `no hook for ${sec.title} (${hook})`)
    else assert.ok(prefix && apHtml.includes(`data-field="${prefix}`), `${sec.title}: nothing on the page matches ${sec.selector}`)
    const fields = expandFields(sec.fields, shown)
    assert.ok(fields.length, `${sec.title}: no fields`)
    for (const f of fields) {
      if (copyKey(f)) assert.ok(marked.has(f), `${sec.title}: ${f} is not marked on the page`)
      else {
        assert.ok(USED_FIELDS.some((u) => u.field === f), `${sec.title}: ${f} is a field this template does not use`)
        assert.ok((LIVE_FIELDS as readonly string[]).includes(f), `${sec.title}: ${f} is a field the live preview cannot show`)
      }
    }
    assert.ok(sec.hint.length > 10, `${sec.title} has no hint`)
  }
  // Michiel, 3 Nov: the H1 and most content are editable; labels are not, nor the proof stories.
  for (const t of ['Headline', 'Subtitle', 'Who we are', 'Where it fits', 'Speaks your language', 'Proof headline', 'First 90 days', 'Close'])
    assert.ok(AGENT_PLATFORM_EDIT.some((s) => s.title === t), `${t} is not offered`)
  const offered = AGENT_PLATFORM_EDIT.flatMap((s) => expandFields(s.fields, shown))
  assert.ok(!offered.some((f) => /eyebrow|caption|button|story|stories/i.test(f)), 'a label or a proof story is offered')
})

test('every field a live edit can change on this template has the page elements that render it marked', () => {
  const marked = new Set([...apSearch('?state=customer').matchAll(/data-field="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)))
  const here = USED_FIELDS.map((f) => f.field).filter((f) => (LIVE_FIELDS as readonly string[]).includes(f))
  assert.ok(here.length >= 8)
  for (const f of here) assert.ok(marked.has(f), `no data-field="${f}" on the page`)
})

test('page copy: only the template\'s keys, plain text within limits, lists for the checklist', () => {
  assert.deepEqual([...COPY_THEMES], THEME_ORDER, 'COPY_THEMES is THEME_ORDER')
  assert.equal(copyKey('copy.hero.h1'), 'hero.h1')
  assert.equal(copyKey('copy.usecases.geo.title'), 'usecases.geo.title')
  assert.equal(copyKey('copy.usecases.nonsense.title'), null)
  assert.equal(copyKey('copy.hero.eyebrow'), null)
  assert.equal(copyKey('headline'), null)
  assert.equal(copyValue('hero.h1', '  Heineken, meet <b>your</b> ##agents##.  '), 'Heineken, meet your ##agents##.')
  assert.equal(copyValue('hero.h1', ''), null)
  assert.equal(copyValue('hero.h1', 'x'.repeat(701)), null)
  assert.equal(copyValue('hero.h1', ['a']), null)
  assert.deepEqual(copyValue('language.checks', ['One', ' Two ', '']), ['One', 'Two'])
  assert.equal(copyValue('language.checks', 'One'), null)
  assert.deepEqual(readCopy({ 'hero.h1': 'Ok', 'hero.eyebrow': 'no', 'fit.lead': 3, __proto__x: 'no' }), { 'hero.h1': 'Ok' })
  assert.deepEqual(readCopy(null), {})
  // What the stream route keeps from Mark's events: applied copy edits, the last per key.
  assert.deepEqual(
    copyEdits([
      { type: 'edit', field: 'copy.hero.h1', value: 'First', status: 'applied' },
      { type: 'edit', field: 'copy.hero.h1', value: 'Second' },
      { type: 'edit', field: 'copy.close.line', value: 'Skipped', status: 'skipped' },
      { type: 'edit', field: 'intelStats', value: [] },
      { type: 'edit', field: 'copy.hero.badkey', value: 'No' },
      { type: 'done', saved: true },
    ]),
    { 'hero.h1': 'Second' },
  )
  assert.deepEqual(expandFields(['techStack', 'copy.close.*'], { 'close.heading': 'x', 'close.line': 'y', 'hero.h1': 'z' }), ['techStack', 'copy.close.heading', 'copy.close.line'])
  assert.ok(COPY_KEYS.length > 20)
})

test('the agent platform page draws its own copy where it has some, the template\'s everywhere else', () => {
  const page = { ...stackPage(), pageCopy: { 'hero.h1': 'Heineken, meet ##your agents##.', 'ninety.step1.title': 'Plug in', 'language.checks': ['Knows the brand book'] } }
  const html = renderToString(<AgentPlatformPage page={page as CompetitorComparisonPage} />)
  const text = textOf(html)
  assert.ok(html.includes('Heineken, meet '), 'the own headline is not drawn')
  assert.deepEqual([...extrudedRuns(html)], ['your agents'], 'the own headline\'s run is not the extruded one')
  assert.ok(text.includes('Plug in') && !text.includes('Connect Link'), 'the own step title is not drawn')
  assert.ok(text.includes('Knows the brand book'))
  // Everything else is the template's.
  const c = fromLegacyPage(page as CompetitorComparisonPage)
  const base = templateCopy(c)
  assert.ok(text.includes(String(base['who.heading']).replace(/##/g, '')))
  // Every part of the template's copy the page shows is marked, so Edit mode can spotlight and glow it.
  const marked = new Set([...html.matchAll(/data-field="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)))
  for (const k of Object.keys(base)) assert.ok(marked.has(`copy.${k}`), `copy.${k} is not marked on the page`)
  // An own value for a key the template doesn't have is ignored.
  assert.equal(resolveCopy(c, { 'nope.key': 'x' } as never)['nope.key'], undefined)
})

test('a live copy edit re-renders the page from the new text; the replay compares saved copy', () => {
  resetLive()
  assert.ok(applyLiveField('copy.hero.h1', 'Live ##headline## now.'))
  assert.ok(!applyLiveField('copy.hero.h1', ''), 'an empty headline is accepted')
  assert.ok(!applyLiveField('copy.hero.eyebrow', 'x'), 'a label is accepted')
  const shown = mergeLive(stackPage() as unknown as Record<string, unknown>, getLivePatch())
  assert.equal(liveFieldValue(shown, 'copy.hero.h1'), 'Live ##headline## now.')
  const html = renderToString(<AgentPlatformPage page={shown as unknown as CompetitorComparisonPage} />)
  assert.deepEqual([...extrudedRuns(html)], ['headline'])
  assert.ok(html.includes('Live ') && html.includes(' now.'))
  // The page's other own copy stays when one key is edited live.
  const withOwn = mergeLive({ pageCopy: { 'close.line': 'Kept' } } as Record<string, unknown>, getLivePatch())
  assert.deepEqual(withOwn.pageCopy, { 'close.line': 'Kept', 'hero.h1': 'Live ##headline## now.' })
  const saved = { pageCopy: { 'hero.h1': 'Saved headline.', 'close.line': 'Kept' } }
  assert.deepEqual(changedLiveFields(['copy.hero.h1', 'copy.close.line', 'techStack'], withOwn, saved), ['copy.hero.h1'])
  resetLive()
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
  // The takeout and person pages send exactly what they always did.
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
  // Only fields a live edit may change; a colour never replays.
  assert.deepEqual(changedLiveFields(['brandAccentColor'], { ...shown, brandAccentColor: 'a' }, { ...saved, brandAccentColor: 'b' }), [])
})

test('the live store checks each value\'s shape and starts empty for the server', () => {
  assert.equal(liveValue('techStack', [{ Name: 'X', ColorTag: null }]) !== null, true)
  assert.equal(liveValue('techStack', 'Shopify'), null)
  assert.equal(liveValue('intelStats', [{ Value: 3, Label: 'x' }]), null)
  assert.equal(liveValue('footerTagline', 'Hello'), 'Hello')
  assert.equal(applyLiveField('brandAccentColor', '#ff0000'), false, 'a field no live edit may change (a colour)')
  assert.equal(applyLiveField('link', 'https://example.test'), false, 'a link field (it changes on the reload)')
  assert.equal(applyLiveField('techStack', { Name: 'not an array' }), false)
  assert.equal(applyLiveField('footerLegal', 'Edited'), true)
  resetLive()
  // The server render never sees a live edit (useSyncExternalStore's server snapshot is empty).
  assert.ok(!renderToString(<AgentPlatformPage page={stackPage()} />).includes('Edited'))
})

/* ------------------------------------------------------------- the CMS preview */

console.log('\nthe CMS preview: on-page editing hooks (Optimizely CMS SDK)')

/** The full offer with Visual Builder node keys, as Graph returns them: S<n> per section, E<n>x<m> per element. */
function keyedOffer() {
  const o = fullOffer() as unknown as { composition: { nodes: Array<Record<string, unknown>> } } & Record<string, unknown>
  o.composition.nodes.forEach((s, i) => {
    s.key = `S${i}`
    const rows = s.rows as Array<{ columns: Array<{ elements: Array<Record<string, unknown>> }> }>
    rows.forEach((r, j) => r.columns.forEach((c) => c.elements.forEach((e, k) => (e.key = `E${i}x${j}x${k}`))))
  })
  return o
}
const offerNodeKeys = (o: ReturnType<typeof keyedOffer>) => ({
  sections: o.composition.nodes.map((s) => s.key as string),
  elements: o.composition.nodes.flatMap((s) =>
    (s.rows as Array<{ columns: Array<{ elements: Array<{ key: string }> }> }>).flatMap((r) => r.columns.flatMap((c) => c.elements.map((e) => e.key))),
  ),
})

/** Every editing hook in the markup: `edit:<property>` (data-epi-edit) or `block:<node key>` (data-epi-block-id). */
const epi = (html: string) => [...html.matchAll(/data-epi-(edit|block-id)="([^"]*)"/g)].map((m) => `${m[1] === 'edit' ? 'edit' : 'block'}:${m[2]}`)

test('outside the CMS editor no page carries an editing hook: the live pages render as they did', () => {
  assert.deepEqual(epi(apHtml), [])
  assert.deepEqual(epi(renderToString(<OfferPage experience={keyedOffer()} />)), [])
  // The CMS's plain preview (ctx=preview) is a reader's view too.
  assert.deepEqual(epi(renderToString(<CmsEditProvider editing={false}><AgentPlatformPage page={stackPage()} /></CmsEditProvider>)), [])
})

test('in the CMS editor the account page outlines each CMS field it shows, and nothing that is not one', () => {
  for (const state of ['prospect', 'open-opp', 'customer'] as const) {
    const html = renderToString(<CmsEditProvider editing><AgentPlatformPage page={stackPage()} search={`?state=${state}`} /></CmsEditProvider>)
    // Every element that renders one page field carries that field's hook...
    for (const m of html.matchAll(/<[a-z]+ [^>]*data-field="([^" ]+)"[^>]*>/g)) {
      if (!ACCOUNT_PAGE_PROPERTIES.includes(m[1])) continue
      assert.ok(m[0].includes(`data-epi-edit="${m[1]}"`), `${state}: an element showing ${m[1]} has no data-epi-edit`)
    }
    const hooks = epi(html)
    // ...the small print too, line by line...
    for (const f of ['customerLogo', 'intelStats', 'techStack', 'investments', 'stakeholders', 'footerTagline', 'footerLegal'])
      assert.ok(hooks.includes(`edit:${f}`), `${state}: ${f} is not outlined`)
    // ...and each hook names a property of the content type: the template's own copy (copy.*) is
    // not the CMS's to edit, and an account page has no Visual Builder nodes.
    assert.deepEqual(hooks.filter((h) => !h.startsWith('edit:') || !ACCOUNT_PAGE_PROPERTIES.includes(h.slice(5))), [], state)
  }
})

/**
 * The takeout page's stored fields the CMS can't outline where they show: values that are not
 * text on the page (a colour, a link target, the alt text) or that sit inside a vendored card
 * drawn from several fields (a quote's job title and company, the ROI label), or outside the page
 * (the sticky bar, hidden in the preview; the schedule link, in the panel).
 */
const NOT_OUTLINED = new Set([
  'brandAccentColor', 'link', 'challengeScreenshotAlt', 'promoCTALink', 'endCTALink', 'analystCTALink',
  'testimonial1JobTitle', 'testimonial1Company', 'testimonial2JobTitle', 'testimonial2Company', 'roiProjectionLabel',
  'stickyCTAText', 'modalScheduleUrl',
])

test('in the CMS editor the takeout page outlines every stored field it shows', () => {
  const html = renderToString(<CmsEditProvider editing><AccountPage page={fullAccountPage()} /></CmsEditProvider>)
  const hooks = new Set(epi(html).filter((h) => h.startsWith('edit:')).map((h) => h.slice(5)))
  const shown = ACCOUNT_FIELDS.filter((f) => f.use === 'text' || f.use === 'attr').map((f) => f.field)
  assert.deepEqual(shown.filter((f) => !hooks.has(f) && !NOT_OUTLINED.has(f)), [], 'shown but not outlined')
  assert.deepEqual([...hooks].filter((f) => !ACCOUNT_PAGE_PROPERTIES.includes(f)), [], 'a hook names no property')
  assert.deepEqual(epi(renderToString(<AccountPage page={fullAccountPage()} />)), [], 'hooks outside the editor')
})

test('in the CMS preview the page lays out for a fixed window: no scene grows with the frame', () => {
  const css = readFileSync('src/www/www.css', 'utf8')
  // Every window height reads the variable the preview sets...
  const bare = css.replace(/var\(--www-s?vh, 1s?vh\)/g, '').match(/(?<![\w.-])\d+(?:\.\d+)?s?vh\b/g)
  assert.equal(bare, null, `window heights not behind the variable: ${bare}`)
  // ...and the preview fixes it, and drops the full-window minimums and the sticky bar.
  assert.match(css, /html\[data-cms-preview\] \{\s*--www-vh: 9px;\s*--www-svh: 9px;/)
  assert.match(css, /html\[data-cms-preview\] \.www-page,\s*html\[data-cms-preview\] \.vb-experience \{\s*min-height: 0;/)
  assert.match(readFileSync('src/components/CmsPreview.tsx', 'utf8'), /setAttribute\('data-cms-preview', ''\)/)
  // Set before the first render, so the loading and error screens are bounded too.
  assert.match(readFileSync('src/main.tsx', 'utf8'), /if \(inCmsPreview\(\)\) document\.documentElement\.setAttribute\('data-cms-preview', ''\)/)
  assert.match(readFileSync('src/index.css', 'utf8'), /html\[data-cms-preview\] \.min-h-screen \{\s*min-height: 560px;/)
})

test('in the CMS editor every offer section and element is outlined by its Visual Builder node', () => {
  const o = keyedOffer()
  const html = renderToString(<CmsEditProvider editing><OfferPage experience={o} /></CmsEditProvider>)
  const blocks = new Set(epi(html).filter((h) => h.startsWith('block:')).map((h) => h.slice(6)))
  const { sections, elements } = offerNodeKeys(o)
  assert.deepEqual(sections.filter((k) => !blocks.has(k)), [], 'a section is not outlined')
  assert.deepEqual(elements.filter((k) => !blocks.has(k)), [], 'an element is not outlined')
  assert.deepEqual([...blocks].filter((k) => !sections.includes(k) && !elements.includes(k)), [], 'a hook names no node')
  // The keys are handles, never text: an element's own fields are all the page reads.
  const text = textOf(html)
  assert.ok(![...sections, ...elements].some((k) => new RegExp(`\\b${k}\\b`).test(text)), 'a node key is on the page as text')
  assert.deepEqual(readOffer(o as never).map((s) => s.key), sections)
  assert.equal(nodeKeyOf(undefined), null)
})

test('the CMS preview is not a visit: it is known by its address, and nothing else is', () => {
  assert.equal(inCmsPreview({ pathname: '/preview' }), true)
  assert.equal(inCmsPreview({ pathname: '/preview/' }), true)
  for (const p of ['/heineken/', '/vb/preview', '/previews', '/']) assert.equal(inCmsPreview({ pathname: p }), false, p)
  assert.equal(inCmsPreview(null), false)
})

testAsync('in the CMS preview the sign-up form and the one-click ask send nothing; for a visitor they do', async () => {
  const realFetch = globalThis.fetch
  const g = globalThis as unknown as { window?: unknown }
  const fetched: string[] = []
  const pings: Array<{ url: string; body: string }> = []
  // Stand-ins only: nothing here reaches the network (the webhook is never called for real).
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    if (String(url) === '/api/cta-ping') pings.push({ url: String(url), body: String(init?.body) })
    else fetched.push(String(url))
    return new Response('{}', { status: 200 })
  }) as typeof fetch
  try {
    assert.equal(await postSignup('offer-1', 'editor@optimizely.com', '', { pathname: '/preview', search: '?key=k' }), 'done')
    assert.deepEqual(fetched, [], 'the preview sent a sign-up')
    assert.equal(await postSignup('offer-1', 'reader@example.com', '', { pathname: '/vb/acme', search: '' }), 'done')
    assert.equal(fetched.length, 1, "a visitor's sign-up is not sent")
    sendCtaPing('cta-connect-btn', { pathname: '/preview', search: '?key=k' })
    assert.deepEqual(pings, [], 'the preview pinged the team')
    sendCtaPing('cta-connect-btn', { pathname: '/acme/', search: '?utm_source=outreach&utm_campaign=q4&email=someone%40acme.com' })
    assert.equal(pings.length, 1, "a visitor's ask does not reach the team")
    // The browser names the page and the button, and nothing about who is on the team.
    assert.deepEqual(JSON.parse(pings[0].body), { route: '/acme/', source: 'cta-connect-btn', utm: { source: 'outreach', campaign: 'q4' } })
  } finally {
    globalThis.fetch = realFetch
    delete g.window
  }
})

console.log('\nthe CMS preview: /api/preview serves a draft as the live address would')

type GraphCall = { op: string; url: string; auth: string | null; variables: Record<string, unknown> }

/** Graph, stood in: each operation answered by name, and every call noted with how it was authorised. */
async function withPreviewGraph<T>(answers: Record<string, unknown>, run: (calls: GraphCall[]) => Promise<T>): Promise<T> {
  const realFetch = globalThis.fetch
  const calls: GraphCall[] = []
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { query: string; variables: Record<string, unknown> }
    const op = /query\s+(\w+)/.exec(body.query)?.[1] ?? '?'
    const headers = (init?.headers ?? {}) as Record<string, string>
    calls.push({ op, url: String(url), auth: headers.Authorization ?? null, variables: body.variables })
    return new Response(JSON.stringify(answers[op] ?? { data: null }), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
  try {
    return await run(calls)
  } finally {
    globalThis.fetch = realFetch
  }
}

async function preview(query: Record<string, string>) {
  const out = { status: 0, body: undefined as unknown, headers: {} as Record<string, string> }
  const res = {
    setHeader(k: string, v: string) {
      out.headers[k.toLowerCase()] = v
    },
    status(c: number) {
      out.status = c
      return this
    },
    json(b: unknown) {
      out.body = b
      return this
    },
  }
  await previewHandler({ query } as never, res as never)
  return out
}

const KEY = '0123456789abcdef0123456789abcdef'
const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJlZGl0b3IifQ.c2lnbmF0dXJl'
/**
 * What Graph really answers for a key through `_Content` (measured on the live instance): the BASE
 * type as `__typename`, the concrete one first in `_metadata.types`.
 */
const BASE_TYPE: Record<string, string> = { CompetitorComparisonPage: '_Page', PersonPage: '_Page', ABMExperience: '_Experience', HeroSectionBlock: '_Component' }
const typed = (type: string) => ({
  data: { _Content: { items: [{ __typename: BASE_TYPE[type], _metadata: { types: [type, ...(BASE_TYPE[type] === '_Experience' ? ['_Experience', '_Page'] : [BASE_TYPE[type]]), '_Content', '_Item'] } }] } },
})

test('the preview reads a key\'s own type from what Graph says, base type or concrete', () => {
  assert.equal(concreteType({ __typename: '_Page', _metadata: { types: ['CompetitorComparisonPage', '_Page', '_Content'] } }), 'CompetitorComparisonPage')
  assert.equal(concreteType({ __typename: 'ABMExperience' }), 'ABMExperience')
  assert.equal(concreteType({ __typename: '_Experience', _metadata: { types: ['_Experience'] } }), null)
  assert.equal(concreteType(undefined), null)
})

testAsync("an account page draft: the editor's token, the live page's fields, and the page's own copy", async () => {
  const store = memoryStore()
  await store.set('pc:acme', { values: { 'hero.h1': 'Acme, here is a headline of its own' }, edits: [] })
  useCopyStore(store)
  try {
    const draft = { ...stackPage(), _metadata: { key: KEY, url: { default: '/acme/', hierarchical: '/acme/' } } }
    await withPreviewGraph(
      { GetPreviewType: typed('CompetitorComparisonPage'), GetPagePreview: { data: { CompetitorComparisonPage: { items: [draft] } } } },
      async (calls) => {
        const r = await preview({ key: KEY, ver: '42', loc: 'en', ctx: 'edit', preview_token: TOKEN })
        assert.equal(r.status, 200)
        assert.equal(r.headers['cache-control'], 'no-store')
        const page = r.body as CompetitorComparisonPage & { __typename: string }
        assert.equal(page.__typename, 'CompetitorComparisonPage')
        assert.deepEqual(page.pageCopy, { 'hero.h1': 'Acme, here is a headline of its own' })
        // The draft, read as the editor: their token, never the site's key, for exactly this version.
        assert.deepEqual(calls.map((c) => c.op), ['GetPreviewType', 'GetPagePreview'])
        for (const c of calls) {
          assert.equal(c.auth, `Bearer ${TOKEN}`)
          assert.ok(!c.url.includes('auth='), 'the site key was sent with an editor token')
          assert.deepEqual(c.variables, { key: KEY, ver: '42', loc: ['en'] })
        }
        // The preview draws the agent platform template, with the page's own headline.
        const html = renderToString(<AgentPlatformPage page={page} />)
        assert.match(html, /class="www-page[^"]*\bwww-ap\b/)
        assert.match(textOf(html), /Acme, here is a headline of its own/)
      },
    )
  } finally {
    useCopyStore(undefined)
  }
})

testAsync('an offer page draft comes back as the /vb/ route serves it, and draws the www offer page', async () => {
  const o = keyedOffer()
  const draft = { ...o, _metadata: { key: KEY, url: { default: '/acme-offer/', hierarchical: '/acme-offer/' } } }
  await withPreviewGraph({ GetPreviewType: typed('ABMExperience'), GetABMExperiencePreview: { data: { ABMExperience: { items: [draft] } } } }, async (calls) => {
    const r = await preview({ key: KEY, preview_token: TOKEN })
    assert.equal(r.status, 200)
    const exp = r.body as Record<string, unknown>
    assert.equal(exp.__typename, 'ABMExperience')
    assert.equal(exp.__template, 'abm-experience')
    assert.ok(isOfferExperience(exp))
    assert.deepEqual(calls.slice(0, 2).map((c) => c.op), ['GetPreviewType', 'GetABMExperiencePreview'])
    const html = renderToString(<CmsEditProvider editing><OfferPage experience={exp} /></CmsEditProvider>)
    assert.match(html, /class="www-page [^"]*www-offer/)
    assert.ok(epi(html).includes('block:S0'), 'the hero section is not outlined')
  })
})

testAsync('a legacy block draft comes back with its own fields; published content is read with the site key', async () => {
  const env = { ...process.env }
  process.env.GRAPH_AUTH_KEY = 'site-key'
  delete process.env.GRAPH_SINGLE_KEY
  try {
    await withPreviewGraph(
      { GetPreviewType: typed('HeroSectionBlock'), GetPreviewBlock: { data: { _Content: { items: [{ __typename: 'HeroSectionBlock', Eyebrow: 'B-eyebrow' }] } } } },
      async (calls) => {
        const r = await preview({ key: KEY })
        assert.equal(r.status, 200)
        assert.equal((r.body as { Eyebrow: string }).Eyebrow, 'B-eyebrow')
        assert.ok(calls.every((c) => c.auth === null && c.url.endsWith('?auth=site-key')))
        assert.deepEqual(calls[0].variables, { key: KEY })
      },
    )
  } finally {
    process.env = env
  }
})

testAsync('/api/preview refuses what is not a key, version, locale or token, and says when there is no such draft', async () => {
  await withPreviewGraph({ GetPreviewType: { data: { _Content: { items: [] } } } }, async (calls) => {
    for (const q of [{}, { key: '../etc' }, { key: KEY, ver: '1 OR 1' }, { key: KEY, loc: 'en"}' }, { key: KEY, preview_token: 'a token' }]) {
      assert.equal((await preview(q as Record<string, string>)).status, 400, JSON.stringify(q))
    }
    assert.equal(calls.length, 0, 'a refused request reached Graph')
    assert.equal((await preview({ key: KEY, preview_token: TOKEN })).status, 404)
  })
})

testAsync("an expired editor token is said as such (401), never read as \"no such draft\"", async () => {
  // Graph's answer to a CMS preview token past its five minutes, as measured on the live instance.
  const expired = { code: 'AUTHENTICATION_ERROR', status: 401, details: { msg: 'Token expired' } }
  await withPreviewGraph({ GetPreviewType: expired }, async (calls) => {
    const r = await preview({ key: KEY, ver: '7', preview_token: TOKEN })
    assert.equal(r.status, 401)
    assert.match((r.body as { error: string }).error, /Token expired/)
    assert.equal((r.body as { expired: boolean }).expired, true)
    assert.equal(calls.length, 1, 'kept asking Graph after it refused the token')
  })
  assert.match(readFileSync('src/hooks/usePreviewContent.ts', 'utf8'), /401[\s\S]*timed out[\s\S]*Reload it in the CMS/)
})

testAsync('a Graph error is logged with the key and version, never with the editor token', async () => {
  const realError = console.error
  const logged: string[] = []
  console.error = (...a: unknown[]) => void logged.push(a.map(String).join(' '))
  try {
    await withPreviewGraph({ GetPreviewType: { errors: [{ message: 'Field "nope" is not defined' }] } }, async () => {
      assert.equal((await preview({ key: KEY, ver: '7', preview_token: TOKEN })).status, 404)
    })
  } finally {
    console.error = realError
  }
  assert.ok(logged.some((l) => l.includes('GetPreviewType') && l.includes(KEY)), 'the failure was not logged')
  assert.ok(!logged.some((l) => l.includes(TOKEN)), 'the token was logged')
})

test('the CMS preview loads the editor script from the CMS and refreshes through the SDK, in place', () => {
  const src = readFileSync('src/components/CmsPreview.tsx', 'utf8')
  assert.match(src, /from '@optimizely\/cms-sdk\/react\/client'/)
  assert.match(src, /<PreviewComponent onNavigate=\{onNavigate\}/)
  assert.match(src, /\/util\/javascript\/communicationinjector\.js/)
  assert.match(src, /https:\/\/app-opti01saas4uc99t001\.cms\.optimizely\.com/)
  // The draft is fetched again on a save; the page is never reloaded and the frame never leaves this site.
  assert.ok(!/location\.(reload|replace|assign)\(/.test(src), 'the preview reloads the page')
  const hook = readFileSync('src/hooks/usePreviewContent.ts', 'utf8')
  assert.ok(!/addEventListener\(/.test(hook), 'a second save listener beside the SDK')
})

console.log('\nthe person page: the 1:1 buyer page in the www design')

/** A person page with every stored field filled, each with a value that can only come from that field. */
function fullPersonPage(over: Partial<PersonPageData> = {}): PersonPageData {
  return {
    _metadata: { key: 'p0000000000000000000000000000001', url: { default: '/logitech/ben-yu/', hierarchical: '/logitech/ben-yu/' } },
    template: 'person',
    companySlug: 'logitech',
    companyName: 'Logitech G',
    personSlug: 'ben-yu',
    crmContactId: 'CRM-0035e00001XyZ',
    PageTitle: 'P-title',
    MetaDescription: 'P-meta',
    noIndex: true,
    personName: 'Ben Yu',
    personTitle: 'P-title-of-person',
    personInitials: 'P-INI',
    personLinkedIn: { default: 'https://www.linkedin.com/in/p-linkedin' },
    personAvatarColor: '#ff00aa',
    companyLogo: { default: 'https://example.test/p-logo.svg' },
    brandAccentColor: '#00b8fc',
    heroEyebrow: 'P-eyebrow',
    heroHeadline: 'P-headline',
    heroSubheadline: 'P-subheadline',
    heroCtaText: 'P-hero-cta',
    heroCtaUrl: { default: 'https://www.optimizely.com/contact/?p-hero-url' },
    engagementTier: 'engaged',
    engagementHeadline: 'P-SECRET-engagement-headline',
    engagementSummary: 'P-SECRET-engagement-summary',
    touchpoints: [{ Date: '2026-01-01', Kind: 'email', Summary: 'P-SECRET-touchpoint', OptimizelyPerson: 'P-SECRET-sender' } as never],
    openOpportunityName: 'P-SECRET-opportunity',
    openOpportunityStage: 'P-SECRET-stage',
    openOpportunityDetail: 'P-SECRET-opportunity-detail',
    remitHeadline: 'P-remit-headline',
    remitIntro: 'P-SECRET-remit-intro',
    remitPoints: [{ Title: 'P-remit-title', Description: 'P-remit-desc', Metric: 'P-remit-metric' }],
    roleFrame: 'P-role-frame',
    noteBody: 'P-note-body',
    noteSignedBy: 'Caleb Ping',
    noteSignedByRole: 'P-signed-role',
    noteSignedByInitials: 'PQ',
    noteDate: '2026-10-22',
    researchHeadline: 'P-SECRET-research-headline',
    researchClaim: 'P-SECRET-research-claim',
    provenance: [
      { Register: 'read', Text: 'P-read-fact', SourceLabel: 'P-read-source', SourceUrl: { default: 'https://example.test/p-read' } },
      { Register: 'told', Text: 'P-told-words', SourceLabel: 'P-told-source', SourceUrl: { default: 'https://example.test/p-told' } },
      { Register: 'assumed', Text: 'P-assumed', SourceLabel: 'P-SECRET-assumed-source', SourceUrl: null },
    ],
    scorecardHeadline: 'P-scorecard-headline',
    scorecardIntro: 'P-SECRET-scorecard-intro',
    scorecard: [{ Measure: 'P-measure', WhyHard: 'P-why-hard', WhatChanges: 'P-what-changes', Metric: 'P-metric' }],
    solutionsHeadline: 'P-solutions-headline',
    solutionsIntro: 'P-solutions-intro',
    solutions: [{ Product: 'opal', Headline: 'P-solution-headline', Body: 'P-solution-body', WhyFirst: 'P-why-first' }],
    keyNumberValue: '4',
    keyNumberPrefix: 'EUR',
    keyNumberSuffix: 'M+',
    keyNumberLabel: 'P-key-label',
    keyNumberDetail: 'P-key-detail',
    keyNumberCitationUrl: { default: 'https://example.test/p-cite' },
    peerProofHeadline: 'P-peer-headline',
    peerProof: [
      { Quote: 'P-quote-1', PersonName: 'P-peer', PersonTitle: 'P-peer-title', Company: 'P-peer-co', SourceUrl: { default: 'https://example.test/p-story' } },
      { Quote: 'P-quote-dup', PersonName: 'P-peer', PersonTitle: 'P-peer-title', Company: 'P-peer-co', SourceUrl: null },
    ],
    teamHeadline: 'P-team-headline',
    team: [
      { Initials: 'CP', Name: 'Caleb Ping', Role: 'Enterprise Account Executive', Email: 'caleb.ping@optimizely.com', AvatarColor: null, AlreadyMet: true },
      { Initials: 'SA', Name: 'Solutions Architect', Role: 'Solutions Architect', Email: null, AvatarColor: null, AlreadyMet: false },
      { Initials: 'AE', Name: 'Account Executive', Role: 'Account Executive', Email: null, AvatarColor: null, AlreadyMet: false },
      { Initials: 'ZF', Name: 'Zac Fenn', Role: 'P-team-role', Email: null, AvatarColor: null, AlreadyMet: false },
    ],
    ctaTitle: 'P-cta-title',
    ctaBody: 'P-cta-body',
    ctaButtonText: 'P-cta-button',
    meetingUrl: { default: 'https://scheduler.zoom.us/p-booking' },
    footerLine: 'P-footer-line',
    generatedAt: 'P-SECRET-generated-at',
    generatedBy: 'P-SECRET-generated-by',
    ...over,
  } as PersonPageData
}
const personHtml = renderToString(<PersonPage page={fullPersonPage()} />)

test('PERSON_FIELDS places every PersonPage field, and the query fetches only the ones the page uses', () => {
  const src = readFileSync('src/lib/person-page-query.ts', 'utf8')
  const list = src.slice(src.indexOf('const PERSON_PAGE_FIELDS = `') + 28, src.indexOf('`;', src.indexOf('const PERSON_PAGE_FIELDS')))
  let flat = list
  while (/\{[^{}]*\}/.test(flat)) flat = flat.replace(/\{[^{}]*\}/g, ' ')
  const queried = flat.split(/\s+/).filter((w) => w && w !== '_metadata')
  // The query fetches exactly what the page uses: a field it never shows never leaves the CMS.
  assert.deepEqual([...PERSON_FIELDS.filter((f) => f.use !== 'never').map((f) => f.field)].sort(), [...queried].sort())
  for (const f of ['crmContactId', 'openOpportunityName', 'openOpportunityStage', 'touchpoints', 'engagementSummary']) {
    assert.ok(!queried.includes(f), `${f} is fetched`)
    assert.equal(PERSON_FIELDS.find((p) => p.field === f)?.use, 'never', f)
  }
})

test('a person page shows every stored field it places, and nothing that is never shown', () => {
  const text = textOf(personHtml)
  const page = fullPersonPage() as unknown as Record<string, unknown>
  const strings = (v: unknown): string[] =>
    typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []
  for (const f of PERSON_FIELDS.filter((x) => x.use === 'text')) {
    const values = strings(page[f.field]).filter((v) => v.startsWith('P-') && !v.startsWith('P-SECRET'))
    for (const v of values) {
      // Fields shown only when another is missing are checked below.
      if (['P-remit-headline', 'P-remit-title', 'P-remit-desc', 'P-remit-metric', 'P-what-changes', 'P-quote-dup', 'P-title-of-person'].includes(v)) continue
      assert.ok(text.includes(v), `${f.field}: "${v}" is not on the page`)
    }
  }
  assert.ok(!/P-SECRET/.test(personHtml), `a never-shown field reached the page: ${personHtml.match(/P-SECRET[\w-]*/g)}`)
  assert.ok(!personHtml.includes('CRM-0035e'), 'the Salesforce contact id is on the page')
  assert.ok(!personHtml.includes('p-hero-url'), 'the hero links out to the stored contact form')
  // The attr fields, in the markup.
  for (const v of ['https://www.linkedin.com/in/p-linkedin', 'https://example.test/p-logo.svg', 'https://example.test/p-cite', 'https://example.test/p-read', '/logitech/']) {
    assert.ok(personHtml.includes(v), v)
  }
  assert.match(personHtml, /--www-accent:#00b8fc/)
  // The pairs: a headline replaces the name as the h1, a subheadline the title; the scorecard replaces remitPoints.
  assert.match(personHtml, /<h1[^>]*>.*P-headline/s)
  const bare = textOf(renderToString(<PersonPage page={fullPersonPage({ heroHeadline: null, heroSubheadline: null, scorecard: [] })} />))
  for (const v of ['Ben Yu', 'P-title-of-person', 'P-remit-headline', 'P-remit-title', 'P-remit-desc', 'P-remit-metric']) assert.ok(bare.includes(v), v)
})

test("a person page never shows our conversations with them: no badge, no 'You have met', no quote from an email or call", () => {
  const text = textOf(personHtml)
  for (const tier of ['key', 'engaged', 'known'] as const) {
    const t = textOf(renderToString(<PersonPage page={fullPersonPage({ engagementTier: tier })} />))
    assert.ok(!/conversation|In conversation|An introduction|Active opportunity|opportunity|pipeline|stage/i.test(t.replace(/P-SECRET[\w-]*/g, '')), `${tier}: relationship language on the page`)
  }
  assert.ok(!/You have met|have met/i.test(text), 'who they have met is on the page')
  assert.ok(!/data-xray="person-tier"/.test(personHtml), 'the engagement badge is still drawn')
  // Their published words stay, with the source; words from an email, a call or a meeting never reach the page.
  const page = fullPersonPage({
    provenance: [
      { Register: 'told', Text: 'P-published-words', SourceLabel: 'Interview, 2026', SourceUrl: { default: 'https://example.test/interview' } },
      { Register: 'told', Text: 'P-SECRET-email-words', SourceLabel: 'Your email to Optimizely, April 2026', SourceUrl: null },
      { Register: 'told', Text: 'P-SECRET-call-words', SourceLabel: 'Call with Erlin Saenz', SourceUrl: { default: 'mailto:erlin@optimizely.com' } },
      { Register: 'assumed', Text: 'P-assumed', SourceLabel: 'Assumption', SourceUrl: null },
      { Register: 'read', Text: 'P-read-fact', SourceLabel: 'P-read-source', SourceUrl: { default: 'https://example.test/p-read' } },
    ],
  })
  const html = renderToString(<PersonPage page={page} />)
  assert.match(textOf(html), /You said\s*P-published-words/)
  assert.ok(!/P-SECRET/.test(html), 'an unpublished quote is on the page')
  assert.ok(!/Your email to Optimizely|Call with Erlin/.test(html), 'the source of an unpublished quote is on the page')
  // ...and the server never sends them: what api/content.ts, the server render and the preview ship.
  const shipped = JSON.stringify(publicPersonPage(page).provenance)
  assert.ok(!/P-SECRET/.test(shipped), 'an unpublished quote leaves the server')
  assert.ok(shipped.includes('P-published-words') && shipped.includes('P-assumed') && shipped.includes('P-read-fact'))
  for (const f of ['api/content.ts', 'server/ssr-handler.tsx', 'api/preview.ts']) {
    assert.match(readFileSync(f, 'utf8'), /publicPersonPage\(items\[0\]/, `${f} ships the page without publicPersonPage`)
  }
  // The rest of the rules.
  assert.match(text, /We assumed\s*P-assumed/)
  assert.match(text, /If any of that is wrong, tell Caleb Ping and we.ll rewrite it/)
  assert.ok(!text.includes('Solutions Architect') && !/Account Executive\b(?! )/.test(text.replace('Enterprise Account Executive', '')), 'a placeholder contact')
  assert.equal(peerProofOf(fullPersonPage()).length, 1)
  assert.equal(keyNumberText({ keyNumberPrefix: 'EUR', keyNumberValue: '4', keyNumberSuffix: 'M+' }), '€4M+')
  assert.equal(keyNumberText({ keyNumberPrefix: null, keyNumberValue: '1500', keyNumberSuffix: null }), '1,500')
  assert.equal(formatDate('2026-10-22'), '22 Oct 2026')
  assert.deepEqual(measuresOf({ scorecard: [], remitPoints: null }), [])
})

test("the account page's stakeholder cards say who they are, never our conversations with them", () => {
  const html = renderToString(<AccountPage page={{ ...account, stakeholders: [{ Initials: 'FS', Name: 'F-stakeholder-name', Role: 'F-stakeholder-role', LinkedInUrl: null, AvatarColor: null, EngagementTier: 'key', EngagementNote: 'Spoke with Jacob on 9 Sep 2026', PersonSlug: null, CrmContactId: '0038d000008yIznAAE' }] } as CompetitorComparisonPage} />)
  const text = textOf(html)
  assert.ok(text.includes('F-stakeholder-name'))
  for (const leak of ['Active opportunity', 'In conversation', 'Spoke with Jacob', '0038d000008yIznAAE']) assert.ok(!html.includes(leak), `${leak} is on the account page`)
  // Not fetched either, so not in the page's source: the account page and the experience queries.
  for (const f of ['src/lib/account-page-query.ts', 'src/lib/experience-queries.ts']) {
    assert.ok(!/EngagementTier|EngagementNote|CrmContactId/.test(readFileSync(f, 'utf8')), `${f} still fetches a stakeholder's CRM fields`)
  }
})

test('a person page has one ask: the one-click button, with a booking link only when it is one', () => {
  assert.equal((personHtml.match(/id="cta-connect-btn"/g) || []).length, 1)
  assert.ok(!/<form\b|<input\b|<textarea\b/.test(personHtml), 'a form on the page')
  assert.ok(!/<nav\b|<footer\b/.test(personHtml), 'navigation or a footer')
  assert.match(textOf(personHtml), /P-cta-button/)
  assert.deepEqual(personConnectProps(fullPersonPage()).people.map((p) => p.name), ['Caleb Ping', 'Zac Fenn'])
  assert.equal(personConnectProps(fullPersonPage()).scheduleUrl, 'https://scheduler.zoom.us/p-booking')
  // 21 of the 33 pages store optimizely.com/contact: a form, so no "Schedule a call", and no booking promise on the button.
  const contact = fullPersonPage({ meetingUrl: { default: 'https://www.optimizely.com/contact/' } })
  assert.equal(bookingUrlOf(contact), null)
  assert.equal(askLabelOf(contact), 'Talk to your team')
  assert.equal(bookingUrlOf({ meetingUrl: { default: '/bentley-systems/' } }), null)
  assert.equal(bookingUrlOf({ meetingUrl: { default: 'http://calendly.com/x' } }), null)
  assert.match(textOf(renderToString(<PersonPage page={contact} />)), /Talk to your team/)
  // The hero's second button scrolls to the page's argument, never to the stored contact form.
  assert.match(personHtml, /href="#practice"[^>]*>P-hero-cta/)
})

test('X-ray and Edit mode find every part of a person page, and Edit mode names its fields', () => {
  for (const s of PERSON_XRAY_DEFAULTS) assert.ok(personHtml.includes(`data-xray="${s.id}"`), s.id)
  for (const s of PERSON_EDIT) {
    assert.equal(s.selector, `[data-xray="${s.id}"]`)
    for (const f of s.fields) assert.ok(PERSON_FIELDS.some((p) => p.field === f), `${s.id}: ${f} is not a person page field`)
  }
  assert.match(personHtml, /class="www-page[^"]*\bwww-person\b/)
  assert.equal(buildSuggestedEdit([{ title: 'The note', feedback: 'shorter', fields: ['noteBody'] }], 'person'), 'Section: The note\nFields: noteBody\nFeedback: shorter')
})

test('in the CMS editor a person page carries the on-page editing hooks, and nowhere else', () => {
  assert.deepEqual(epi(personHtml), [])
  const hooks = epi(renderToString(<CmsEditProvider editing><PersonPage page={fullPersonPage()} /></CmsEditProvider>))
  for (const f of ['heroEyebrow', 'heroHeadline', 'noteBody', 'scorecard', 'solutions', 'keyNumberValue', 'peerProof', 'team', 'ctaTitle', 'ctaButtonText', 'footerLine']) {
    assert.ok(hooks.includes(`edit:${f}`), f)
  }
  for (const h of hooks) assert.ok(PERSON_FIELDS.some((p) => `edit:${p.field}` === h), `${h} is not a person page field`)
})

testAsync('a person page draft comes back from /api/preview with the live fields, and draws the www person page', async () => {
  const draft = fullPersonPage({ _metadata: { key: KEY, url: { default: '/logitech/ben-yu/', hierarchical: '/logitech/ben-yu/' } } })
  await withPreviewGraph({ GetPreviewType: typed('PersonPage'), GetPersonPagePreview: { data: { PersonPage: { items: [draft] } } } }, async (calls) => {
    const r = await preview({ key: KEY, ver: '7', loc: 'en', ctx: 'edit', preview_token: TOKEN })
    assert.equal(r.status, 200)
    assert.deepEqual(calls.map((c) => c.op), ['GetPreviewType', 'GetPersonPagePreview'])
    const page = r.body as PersonPageData & { __typename: string }
    assert.equal(page.__typename, 'PersonPage')
    assert.match(textOf(renderToString(<PersonPage page={page} />)), /P-note-body/)
  })
})

console.log('\nthe CTA ping: the click reaches the account executive, or the follow-up sheet')

/* The team a page stores, in the order the builder wrote it: an SDR first, a placeholder, then the AE. */
const PING_TEAM = [
  { Initials: 'SR', Name: 'Sam Rep', Role: 'Sales Development Representative', Email: 'sam.rep@optimizely.com' },
  { Initials: 'SA', Name: 'Solutions Architect', Role: 'Solutions Architect', Email: null },
  { Initials: 'AE', Name: 'Alex Exec', Role: 'Enterprise Account Executive', Email: 'Alex.Exec@optimizely.com' },
]
const PING_PAGE = {
  _metadata: { url: { default: '/en/zurich-versicherung/', hierarchical: '/en/zurich-versicherung/' } },
  eyebrow: 'Personalized for Zürich Versicherung',
  intelHeadline: 'We know <em>Zürich Versicherung – “Group” | AG</em>',
  teamMembers: PING_TEAM,
}

test('the account executive is found by role, never by position, and placeholders are nobody', () => {
  assert.equal(accountExecutiveOf(PING_TEAM)?.Name, 'Alex Exec')
  assert.equal(accountExecutiveOf(PING_TEAM.slice(0, 2)), null, 'an SDR is not the account executive')
  assert.equal(accountExecutiveOf([{ Initials: 'AE', Name: 'Your Account Executive', Role: 'Account Executive', Email: null }]), null, 'a role title is not a person')
  assert.equal(accountExecutiveOf([{ Initials: 'x', Name: ' ', Role: 'Account Executive', Email: 'a@optimizely.com' }]), null, 'an unnamed AE')
  assert.equal(accountExecutiveOf(null), null)
  assert.equal(accountExecutiveOf([{ Name: 'Rob Janes', Role: 'Strategic Accounts Executive' }])?.Name, 'Rob Janes', 'a strategic accounts executive is one')
  // The panel says the person the ping told, so with no AE it names nobody ("your Optimizely team").
  const people = PING_TEAM.map((m) => ({ name: m.Name, role: m.Role, email: m.Email, initials: m.Initials }))
  assert.equal(toldFirstName(people), 'Alex')
  assert.equal(toldFirstName(people.slice(0, 1)), undefined)
})

test('a ping names the page, its account executive and the rest of the team; the visitor only the button and campaign', () => {
  const ping = buildPing(accountSource(PING_PAGE as never), 'zurich-versicherung', 'sticky-connect-btn', { source: 'outreach', campaign: 'q4 <takeout>' }, new Date('2026-11-04T23:06:28.545Z'), '77dfb03f-a82d-4ee3-97a1-36b20f6f4043')
  assert.deepEqual(ping.rep, { name: 'Alex Exec', role: 'Enterprise Account Executive', email: 'alex.exec@optimizely.com' })
  assert.deepEqual(ping.team, [{ name: 'Sam Rep', role: 'Sales Development Representative' }], 'the AE twice, or the placeholder')
  assert.equal(ping.page, 'https://showcase.optimizely.com/zurich-versicherung/')
  assert.equal(ping.account, 'Zürich Versicherung – “Group” | AG')
  assert.equal(ping.campaign, 'source: outreach · campaign: q4 <takeout>')
  assert.ok(!JSON.stringify(ping).includes('sam.rep@'), 'only the AE needs an address')
  // Mark's step (mark/cta-ping/step.py) reads exactly this ping in its own tests: Node and Python agree on `check`.
  const fixture = JSON.parse(readFileSync('mark/cta-ping/fixture.json', 'utf8')) as CtaPing
  assert.deepEqual(ping, fixture, 'regenerate mark/cta-ping/fixture.json and rerun python3 mark/cta-ping/test_step.py')
  const { check, ...rest } = ping
  assert.equal(check, checkOf(rest))
  assert.equal(canonicalJson({ b: 1, a: [{ d: null, c: 'ü' }] }), '{"a":[{"c":"ü","d":null}],"b":1}')
  const changed = { ...rest, rep: { ...rest.rep!, email: 'someone.else@optimizely.com' } }
  assert.notEqual(checkOf(changed), check, 'a changed ping keeps its check')
  // No AE on the page: rep is null and everyone real is the team.
  const none = buildPing(accountSource({ ...PING_PAGE, teamMembers: PING_TEAM.slice(0, 2) } as never), 'zurich-versicherung', 'hero-connect-btn', {})
  assert.equal(none.rep, null)
  assert.deepEqual(none.team.map((m) => m.name), ['Sam Rep'])
  assert.equal(none.campaign, '')
  assert.match(none.ping_id, /^[0-9a-f-]{36}$/)
})

test('a ping is only ever for an account page or a person page route', () => {
  assert.deepEqual(pingRouteOf('/tungsten-automation/'), { path: 'tungsten-automation', person: false })
  assert.deepEqual(pingRouteOf('/Lenovo'), { path: 'lenovo', person: false })
  assert.deepEqual(pingRouteOf('/logitech/ben-yu/'), { path: 'logitech/ben-yu', person: true })
  for (const bad of ['/', '/a/b/c/', '/-acme/', '/acme-/', '/../x/', '/acme/../x/', '/acme?x=1', 'acme', 42, null, `/${'a'.repeat(201)}/`]) {
    assert.equal(pingRouteOf(bad), null, String(bad))
  }
})

test("a person page's ping names whose page it is, its account, and its own team's account executive", () => {
  const ping = buildPing(
    personSource({
      _metadata: { url: { default: '/logitech/ben-yu/', hierarchical: '/logitech/ben-yu/' } },
      companyName: 'Logitech G',
      personName: 'Ben Yu',
      team: [
        { Initials: 'ZF', Name: 'Zac Fenn', Role: 'Global Head of Alliances', Email: 'zac@optimizely.com' },
        { Initials: 'CP', Name: 'Caleb Ping', Role: 'Enterprise Account Executive', Email: 'caleb.ping@optimizely.com' },
      ],
    } as never),
    'logitech/ben-yu',
    'cta-connect-btn',
    {},
  )
  assert.equal(ping.page, 'https://showcase.optimizely.com/logitech/ben-yu/')
  assert.equal(ping.account, 'Logitech G')
  assert.equal(ping.person, 'Ben Yu')
  assert.deepEqual(ping.rep, { name: 'Caleb Ping', role: 'Enterprise Account Executive', email: 'caleb.ping@optimizely.com' })
  assert.deepEqual(ping.team, [{ name: 'Zac Fenn', role: 'Global Head of Alliances' }])
})

type PingCall = { url: string; headers: Record<string, string>; body: string }

/** POST /api/cta-ping with Graph and Mark stood in. Nothing reaches the network; KV is off. */
async function ping(
  input: { method?: string; headers?: Record<string, string>; body?: unknown },
  stand: { page?: unknown; person?: unknown; mark?: number; env?: Record<string, string | undefined> } = {},
) {
  const env = { CTA_PING_WEBHOOK_URL: 'https://webhook.mark.optimizely.com/webhooks/inst/trigger', CTA_PING_WEBHOOK_KEY: 'k'.repeat(32), GRAPH_AUTH_KEY: 'graph-key', KV_REST_API_URL: undefined, KV_REST_API_TOKEN: undefined, ...stand.env }
  const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]))
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  const realFetch = globalThis.fetch
  const graph: string[] = []
  const mark: PingCall[] = []
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const u = String(url)
    if (u.startsWith('https://cg.optimizely.com/')) {
      const { query, variables } = JSON.parse(String(init?.body)) as { query: string; variables: { slug: string } }
      graph.push(variables.slug)
      if (/GetPersonPageTeam/.test(query)) {
        const items = stand.person && variables.slug === '/logitech/ben-yu/' ? [stand.person] : []
        return new Response(JSON.stringify({ data: { PersonPage: { items } } }), { status: 200 })
      }
      const items = stand.page && variables.slug === '/en/zurich-versicherung/' ? [stand.page] : []
      return new Response(JSON.stringify({ data: { CompetitorComparisonPage: { items } } }), { status: 200 })
    }
    if (u.startsWith('https://webhook.')) {
      mark.push({ url: u, headers: init?.headers as Record<string, string>, body: String(init?.body) })
      return new Response('{}', { status: stand.mark ?? 200 })
    }
    throw new Error(`unexpected fetch ${u}`)
  }) as typeof fetch
  const out = { status: 0, body: undefined as unknown, headers: {} as Record<string, string> }
  const res = {
    setHeader(k: string, v: string) {
      out.headers[k.toLowerCase()] = v
    },
    status(c: number) {
      out.status = c
      return this
    },
    json(b: unknown) {
      out.body = b
      return this
    },
  }
  const headers = { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', 'x-forwarded-for': '203.0.113.7', ...input.headers }
  try {
    await ctaPingHandler({ method: input.method ?? 'POST', headers, body: input.body, socket: {} } as never, res as never)
  } finally {
    globalThis.fetch = realFetch
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
  return { ...out, graph, mark }
}

const CLICK = { route: '/zurich-versicherung/', source: 'cta-connect-btn', utm: { campaign: 'q4', medium: 'x'.repeat(201) } }

testAsync('POST /api/cta-ping hands Mark the page\'s own team, with the trigger key, and nothing the visitor made up', async () => {
  const r = await ping({ body: { ...CLICK, rep: { email: 'attacker@evil.example' }, team: [{ name: 'Mallory' }] } }, { page: PING_PAGE })
  assert.equal(r.status, 202)
  assert.equal(r.headers['cache-control'], 'no-store')
  assert.deepEqual(r.graph, ['/zurich-versicherung/', '/en/zurich-versicherung/'])
  assert.equal(r.mark.length, 1)
  assert.equal(r.mark[0].url, 'https://webhook.mark.optimizely.com/webhooks/inst/trigger')
  assert.equal(r.mark[0].headers['x-showcase-key'], 'k'.repeat(32))
  const sent = JSON.parse(r.mark[0].body) as CtaPing
  assert.equal(sent.rep?.email, 'alex.exec@optimizely.com', 'the rep came from the request')
  assert.ok(!r.mark[0].body.includes('evil') && !r.mark[0].body.includes('Mallory'))
  assert.equal(sent.button, 'the button at the end of the page')
  assert.equal(sent.campaign, 'campaign: q4', 'an over-long utm value is dropped')
  const { check, ...rest } = sent
  assert.equal(check, checkOf(rest))
})

testAsync('POST /api/cta-ping refuses anything but a same-site JSON click on an account page', async () => {
  const cases: Array<[string, Parameters<typeof ping>[0], number]> = [
    ['GET', { method: 'GET' }, 405],
    ['a form post', { headers: { 'content-type': 'text/plain' }, body: JSON.stringify(CLICK) }, 415],
    ['another site', { headers: { 'sec-fetch-site': 'cross-site' }, body: CLICK }, 403],
    ['an offer page', { body: { ...CLICK, route: '/vb/zurich' } }, 400],
    ['three levels deep', { body: { ...CLICK, route: '/zurich-versicherung/alex-exec/more/' } }, 400],
    ['an unknown button', { body: { ...CLICK, source: 'admin-btn' } }, 400],
    ['no body', { body: undefined }, 400],
    ['too large', { body: JSON.stringify({ ...CLICK, pad: 'x'.repeat(3000) }) }, 413],
  ]
  for (const [name, input, status] of cases) {
    const r = await ping(input, { page: PING_PAGE })
    assert.equal(r.status, status, name)
    assert.equal(r.mark.length + r.graph.length, 0, `${name} reached Graph or Mark`)
  }
})

testAsync("POST /api/cta-ping on a person page reads that page's own team", async () => {
  const person = {
    _metadata: { url: { default: '/logitech/ben-yu/', hierarchical: '/logitech/ben-yu/' } },
    companyName: 'Logitech G',
    personName: 'Ben Yu',
    team: [{ Initials: 'CP', Name: 'Caleb Ping', Role: 'Enterprise Account Executive', Email: 'caleb.ping@optimizely.com' }],
  }
  const r = await ping({ body: { ...CLICK, route: '/logitech/ben-yu/' } }, { page: PING_PAGE, person })
  assert.equal(r.status, 202)
  assert.deepEqual(r.graph, ['/logitech/ben-yu/'], 'looked the person page up as an account page')
  const sent = JSON.parse(r.mark[0].body) as CtaPing
  assert.equal(sent.person, 'Ben Yu')
  assert.equal(sent.rep?.email, 'caleb.ping@optimizely.com')
  const missing = await ping({ body: { ...CLICK, route: '/logitech/nobody/' } }, { page: PING_PAGE, person })
  assert.equal(missing.status, 404)
  assert.equal(missing.mark.length, 0)
})

testAsync('POST /api/cta-ping sends nothing when off, misconfigured, or the page is not there', async () => {
  const off = await ping({ body: CLICK }, { page: PING_PAGE, env: { CTA_PING_WEBHOOK_URL: undefined } })
  assert.equal(off.status, 202, 'previews and local runs (no webhook set) answer as if sent')
  assert.equal(off.mark.length + off.graph.length, 0)
  const elsewhere = await ping({ body: CLICK }, { page: PING_PAGE, env: { CTA_PING_WEBHOOK_URL: 'https://example.com/hook' } })
  assert.equal(elsewhere.status, 202)
  assert.equal(elsewhere.mark.length, 0, 'a webhook that is not Mark got the team')
  const plain = await ping({ body: CLICK }, { page: PING_PAGE, env: { CTA_PING_WEBHOOK_URL: 'http://webhook.mark.optimizely.com/x' } })
  assert.equal(plain.mark.length, 0, 'sent over http')
  const missing = await ping({ body: { ...CLICK, route: '/nobody-here/' } }, { page: PING_PAGE })
  assert.equal(missing.status, 404)
  assert.equal(missing.mark.length, 0)
  const refused = await ping({ body: CLICK }, { page: PING_PAGE, mark: 401 })
  assert.equal(refused.status, 502, 'Mark refusing the key looks like success')
})

testAsync('the browser never holds the Mark webhook or its key', async () => {
  for (const file of ['src/lib/cta-ping.ts', 'src/www/ConnectModal.tsx']) {
    const src = readFileSync(file, 'utf8')
    assert.ok(!/webhook\.(mark|opal)\.optimizely\.com|CTA_PING_WEBHOOK/.test(src), file)
  }
  assert.ok(!/fireDemoWebhook|abm-demo-webhook/.test(readFileSync('src/www/ConnectModal.tsx', 'utf8')))
})

/* -------------------------------------------------------------------- result */

void (async () => {
  for (const [name, fn] of later) {
    try {
      await fn()
      passed++
      console.log(`  ok  ${name}`)
    } catch (err) {
      failures.push(name)
      console.log(`  FAIL ${name}\n       ${(err as Error).message.split('\n').join('\n       ')}`)
    }
  }
  console.log(`\n${passed} passed, ${failures.length} failed`)
  if (failures.length) {
    console.log(failures.map((f) => `  - ${f}`).join('\n'))
    process.exit(1)
  }
})()
