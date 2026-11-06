/**
 * Account page, www design: the classic CompetitorComparisonPage (the ~2,800 Limitless account
 * pages) as a 1:1 landing page. The content model is untouched: every one of the type's 67
 * properties has a place here (./account-fields.ts), and `npm run check:www` renders a page with
 * all of them filled and fails if a stored value is missing.
 *
 * Information order, one idea per scene, each earning the next:
 *   1 hero       we made this for you, and the one thing we want (talk to us)
 *   2 intel      we know you: your numbers, your people
 *   3 signals    what we see you running and investing in
 *   4 challenge  the problem, in your terms
 *   5 comparison the answer, side by side
 *   6 proof      peers who made the move
 *   7 analysts   the independent view
 *   8 statement  the promo line, on its own
 *   9 roi        what it is worth, with the one extruded number
 *  10 path       how we would get there
 *  11 ask        the team and the one-click ask (+ the page's small print)
 *
 * Section ids are the ones the ODP tracking hook observes; `data-xray` hooks are what X-ray and
 * Edit mode find (ABM_XRAY_DEFAULTS).
 */
import type { CompetitorComparisonPage } from '../lib/graph-types'
import { useOdpTracking } from '../hooks/useOdpTracking'
import { ConnectProvider, useConnect } from './ConnectModal'
import { toPeople } from './agent-platform/content'
import { deriveCustomerName } from '../lib/page-identity'
import GravatarAvatar from '../components/GravatarAvatar'
import { Button } from '../vendor/www/components/_ui/button'
import { Badge } from '../vendor/www/components/_ui/badge'
import StatBlock from '../vendor/www/components/block/stat-block'
import CompanyBlock from '../vendor/www/components/block/company-block'
import CarouselLogosClient from '../vendor/www/components/block/carousel-logos/carousel-logos-client'
import TableBlock from '../vendor/www/components/block/table-block'
import { CardArrowCard } from '../vendor/www/components/block/card-arrow-block/card-arrow-card'
import { PortraitTextQuoteCard } from '../vendor/www/components/block/portrait-text-quote-card-block/portrait-text-quote-card'
import { MaterialIcon } from '../vendor/www/components/element/icon-element'
import { cn } from '../vendor/www/lib/utils'
import {
  AccountMark,
  Card,
  Colophon,
  CountUp,
  Eyebrow,
  Heading,
  HeroFrame,
  Initials,
  Reveal,
  Scene,
  Steps,
  StickyCta,
  WwwPage,
  plain,
  richToStacked,
} from './ui'
import { formatStatValue, comparisonTableHtml, realContacts, PROOF_LOGOS, SCENE } from './account-helpers'
import { useCmsEdit, useShowsField } from './cms-edit'
import { useLivePage } from './live-edit'
import type { TeamMember } from '../lib/account-rep'

interface Props {
  page: CompetitorComparisonPage
}

/** What the connect panel shows on this template: the stored team, and the stored "Schedule a call" link. */
export function connectProps(page: CompetitorComparisonPage) {
  return { people: toPeople(page.teamMembers), scheduleUrl: page.modalScheduleUrl?.default || null }
}

export default function AccountPage({ page: stored }: Props) {
  useOdpTracking('abm')
  // Edit mode's live edits (booth only) re-render the page from Mark's streamed values.
  const page = useLivePage(stored)
  const company = deriveCustomerName(page)
  const companySlug =
    (page._metadata?.url?.hierarchical || page._metadata?.url?.default || '')
      .replace(/^\/(en)\//, '/')
      .replace(/^\/+|\/+$/g, '') || null

  return (
    <ConnectProvider {...connectProps(page)}>
    <WwwPage accent={page.brandAccentColor} className="www-takeout">
      <div id="main-content">
        <Hero page={page} company={company} />
        <Intel page={page} company={company} companySlug={companySlug} />
        <Signals page={page} company={company} />
        <Challenge page={page} company={company} />
        <Comparison page={page} />
        <Proof page={page} company={company} />
        <Analysts page={page} />
        <Statement page={page} />
        <Roi page={page} />
        <Path page={page} />
        <Ask page={page} team={realContacts(page.teamMembers)} />
      </div>
      <StickyAsk text={page.stickyCTAText || 'Explore what Optimizely can do'} />
    </WwwPage>
    </ConnectProvider>
  )
}

/** The old page's links end in `#form`; the form is now the ask scene. */
function localHref(url: string | null | undefined, fallback = '#cta'): string {
  if (!url) return fallback
  return /#form$/.test(url) ? '#cta' : url
}

/* ======================================================================= 1 HERO */

function Hero({ page, company }: { page: CompetitorComparisonPage; company: string }) {
  const field = useShowsField()
  return (
    <HeroFrame
      scene={SCENE}
      copy={
        <>
          {/* Whose page this is, once: their logo and the stored eyebrow, above the headline. */}
          <Reveal i={0} fx="scale">
            <AccountMark
              name={company}
              logo={page.customerLogo}
              label={page.eyebrow || `Personalized for ${company}`}
              xray="hero-3d"
              accent={!!page.brandAccentColor}
              edit={{ logo: field('customerLogo'), label: field('eyebrow') }}
            />
          </Reveal>
          <Reveal i={1} data-xray="hero-title" {...field('headline')}>
            <Heading text={plain(page.headline) || `Built for ${company}`} level="h1" className="text-white" />
          </Reveal>
          {page.subheadline && (
            <Reveal i={2} as="p" data-xray="hero-subtitle" className="www-lead text-white/85" {...field('subheadline')}>
              {page.subheadline}
            </Reveal>
          )}
          <Reveal i={3} className="flex flex-wrap gap-3">
            <Button asChild variant="primary" className="www-btn">
              <a href="#cta">Talk to your team</a>
            </Button>
            {page.cta && page.link?.default && (
              <Button asChild variant="white" className="www-btn">
                <a href={localHref(page.link.default)} data-xray="hero-cta" {...field('cta')}>
                  {page.cta}
                </a>
              </Button>
            )}
          </Reveal>
        </>
      }
    />
  )
}

/* ====================================================================== 2 INTEL */

function Intel({ page, company, companySlug }: { page: CompetitorComparisonPage; company: string; companySlug: string | null }) {
  const stats = page.intelStats ?? []
  const people = page.stakeholders ?? []
  const field = useShowsField()
  return (
    <Scene id="intel">
      <div data-xray="intel-headline" className="mb-[min(7vh,64px)]">
        <Reveal i={0} {...field('intelEyebrow')}>
          <Eyebrow>{page.intelEyebrow}</Eyebrow>
        </Reveal>
        <Reveal i={1} {...field('intelHeadline')}>
          <Heading text={richToStacked(page.intelHeadline) || `We know ${company}`} />
        </Reveal>
      </div>
      {stats.length > 0 && (
        <dl className={cn('www-stats', stats.length >= 4 && 'www-stats--4')} {...field('intelStats')}>
          {stats.map((s, i) => (
            <Reveal key={i} i={2 + i} data-xray="intel-stats" className="www-stat">
              <dt className="sr-only">{s.Label}</dt>
              <dd className="www-number">
                <CountUp value={formatStatValue(s.Value)} />
              </dd>
              <dd className="www-body">{s.Label}</dd>
            </Reveal>
          ))}
        </dl>
      )}
      {people.length > 0 && (
        <Reveal i={6} className="mt-[min(8vh,72px)]">
          <h3 className="www-h3 mb-5">The people we&apos;d love to meet</h3>
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" role="list" {...field('stakeholders')}>
            {people.map((p, i) => (
              <li key={i}>
                <Card xray="stakeholders" className="flex h-full items-start gap-4">
                  <Initials initials={p.Initials} />
                  <div className="min-w-0 flex-1">
                    <p className="font-nudge text-2xl leading-tight font-extrabold">{p.Name}</p>
                    <p className="www-small">{p.Role}</p>
                    {/* Who they are, never our conversations with them: no engagement badge, no activity note (Michiel, 6 Nov 2026). */}
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                      {p.LinkedInUrl?.default && (
                        <a href={p.LinkedInUrl.default} target="_blank" rel="noopener noreferrer" className="www-link">
                          LinkedIn<span className="sr-only"> profile of {p.Name} (opens in new tab)</span>
                        </a>
                      )}
                      {p.PersonSlug && companySlug && (
                        <a href={`/${companySlug}/${p.PersonSlug}`} className="www-link">
                          Their page
                        </a>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </Reveal>
      )}
    </Scene>
  )
}

/* ==================================================================== 3 SIGNALS */

function Signals({ page, company }: { page: CompetitorComparisonPage; company: string }) {
  const field = useShowsField()
  const stack = page.techStack ?? []
  const investments = page.investments ?? []
  const news = page.newsItems ?? []
  if (!stack.length && !investments.length && !news.length) return null
  // The legacy ColorTag `var(--orange)` marked the platform being replaced; Optimizely itself is
  // the one already in place. The other colour tags were decoration and are not carried over.
  const competitor = (page.competitorName || '').toLowerCase()
  return (
    <Scene id="signals" tone="neutral">
      <Reveal i={0}>
        <Eyebrow>What we see at {company}</Eyebrow>
      </Reveal>
      <Reveal i={1}>
        <Heading text="The stack you run, and where you're heading" className="mb-[min(6vh,56px)] max-w-[22ch]" />
      </Reveal>
      <div className="grid gap-3 lg:grid-cols-3">
        {stack.length > 0 && (
          <Reveal i={2}>
            <Card tone="white" xray="tech-stack" className="h-full" attrs={field('techStack')}>
              <h3 className="www-h3 mb-1">Running today</h3>
              <p className="www-small mb-5 opacity-75">
                {stack.length} tools on <span {...field('brandDomain')}>{page.brandDomain || company}</span>
              </p>
              <ul className="flex flex-wrap gap-2" role="list">
                {stack.map((t, i) => {
                  const replacing = /orange/.test(t.ColorTag || '') || (!!competitor && t.Name.toLowerCase() === competitor)
                  const ours = /^optimizely/i.test(t.Name)
                  return (
                    <li key={i} className={cn('www-chip', replacing && 'www-stack-pill--flag', ours && 'www-chip--ours')}>
                      {t.Name}
                      {replacing && <span className="www-chip__note">today</span>}
                    </li>
                  )
                })}
              </ul>
            </Card>
          </Reveal>
        )}
        {investments.length > 0 && (
          <Reveal i={3}>
            <Card tone="white" xray="investments" className="h-full" attrs={field('investments')}>
              <h3 className="www-h3 mb-1">Investing in</h3>
              <p className="www-small mb-5 opacity-75">From recent job postings and public initiatives</p>
              <ul className="flex flex-wrap gap-2" role="list">
                {investments.map((inv, i) => (
                  <li key={i}>
                    <Badge label={inv.Name} color={inv.IsPrimary ? 'lfgreen' : 'darkgreen'} filled={!!inv.IsPrimary} size="md" />
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        )}
        {news.length > 0 && (
          <Reveal i={4}>
            <Card tone="white" xray="news" className="h-full" attrs={field('newsItems')}>
              <h3 className="www-h3 mb-5">In the news</h3>
              <ul className="flex flex-col gap-4" role="list">
                {news.map((n, i) => (
                  <li key={i}>
                    <p className="www-caption mb-1">{n.Date}</p>
                    {n.Url?.default ? (
                      <a href={n.Url.default} target="_blank" rel="noopener noreferrer" className="www-body group inline-flex items-start gap-2">
                        <span className="group-hover:underline">{n.Headline}</span>
                        <MaterialIcon name="arrow_outward" size="20" />
                        <span className="sr-only"> (opens in new tab)</span>
                      </a>
                    ) : (
                      <p className="www-body">{n.Headline}</p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        )}
      </div>
    </Scene>
  )
}

/* ================================================================== 4 CHALLENGE */

function Challenge({ page, company }: { page: CompetitorComparisonPage; company: string }) {
  const pains = page.painPoints ?? []
  const shot = page.challengeScreenshotUrl?.default
  const field = useShowsField()
  if (!page.challengeHeadline && !shot) return null
  return (
    <Scene id="challenge">
      <div className="grid gap-[min(4vh,40px)] lg:grid-cols-12 lg:gap-12">
        <div data-xray="challenge-headline" className="flex flex-col gap-[min(4vh,32px)] lg:col-span-5">
          <div>
            <Reveal i={0}>
              <Eyebrow>The challenge</Eyebrow>
            </Reveal>
            <Reveal i={1} {...field('challengeHeadline')}>
              <Heading text={richToStacked(page.challengeHeadline) || `${company}'s site today`} />
            </Reveal>
          </div>
          {shot && (
            // Their site today. The stored capture is small (often 374px wide), so it is shown no
            // wider than it was taken and scrolls through the page inside the frame: sharp, never
            // stretched.
            <Reveal i={2} fx="scale" as="figure" data-xray="challenge-screenshot" className="www-browser">
              <div className="www-browser__bar">
                <span />
                <span />
                <span />
                <span className="www-browser__url" {...field('challengeBrowserUrl')}>
                  {page.challengeBrowserUrl || page.brandDomain || ''}
                </span>
              </div>
              <div className="www-browser__view" {...field('challengeScreenshotUrl')}>
                <img src={shot} alt={page.challengeScreenshotAlt || `${company}'s website today`} loading="lazy" decoding="async" />
              </div>
            </Reveal>
          )}
        </div>
        {pains.length > 0 && (
          <ol className="www-pains lg:col-span-7" role="list" {...field('painPoints')}>
            {pains.map((p, i) => (
              <Reveal key={i} as="li" i={2 + i} fx="right" data-xray="pain-points" className="www-pain">
                <span className="www-pain__n" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="www-h3">{p.Title}</h3>
                  <p className="www-body mt-2 opacity-85">{p.Description}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        )}
      </div>
    </Scene>
  )
}

/* ================================================================= 5 COMPARISON */

function Comparison({ page }: { page: CompetitorComparisonPage }) {
  const field = useShowsField()
  const { editing } = useCmsEdit()
  const rows = page.comparisonTableRows ?? []
  if (!rows.length) return null
  const competitor = page.competitorName || 'Your current platform'
  return (
    <Scene id="comparison">
      <div className="mx-auto max-w-[960px]">
        <div className="mb-[min(5vh,48px)] text-center" data-xray="comparison-heading">
          <Reveal i={0}>
            <Eyebrow className="justify-center">The Optimizely advantage</Eyebrow>
          </Reveal>
          <Reveal i={1} {...field('comparisonHeadline')}>
            <Heading text={page.comparisonHeadline || 'Side by side'} align="center" />
          </Reveal>
          {page.comparisonDescription && (
            <Reveal i={2} as="p" className="www-lead mx-auto mt-4 max-w-[46ch]" {...field('comparisonDescription')}>
              {page.comparisonDescription}
            </Reveal>
          )}
        </div>
        {/* From a tablet up: optimizely.com's TableBlock. It needs 700px, so on a phone the
            Optimizely column would sit behind a sideways scroll; phones get one card per row. */}
        <Reveal i={3} className="www-table hidden md:block" {...field('comparisonTableRows')}>
          <TableBlock TableContent={{ html: comparisonTableHtml(rows, competitor, editing) }} displaySettings={{ tableVariant: 'light' }} />
        </Reveal>
        <ul className="flex flex-col gap-2 md:hidden" role="list" {...field('comparisonTableRows')}>
          {rows.map((r, i) => (
            <Reveal key={i} as="li" i={3 + i} data-xray="comparison-row" className="www-card www-card--neutral www-compare-card">
              <p className="www-body font-semibold">{r.Category}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-white p-3">
                  <dt className="www-small opacity-75">{competitor}</dt>
                  <dd className="www-small mt-1 flex items-center gap-1.5 font-medium">
                    <RatingIcon value={r.CompetitorValue} />
                    {r.CompetitorValue}
                  </dd>
                </div>
                <div className="rounded-2xl bg-white p-3">
                  <dt className="www-small font-semibold">Optimizely</dt>
                  <dd className="www-small mt-1 flex items-center gap-1.5 font-medium">
                    <RatingIcon value={r.OurValue} />
                    {r.OurValue}
                  </dd>
                </div>
              </dl>
            </Reveal>
          ))}
        </ul>
      </div>
    </Scene>
  )
}

/** The table's Yes / No / Limited icons, for the phone cards. Free text gets none. */
function RatingIcon({ value }: { value: string | null }) {
  const k = (value ?? '').trim().toLowerCase()
  const name = k === 'yes' ? 'check' : k === 'no' ? 'close' : k === 'limited' ? 'error' : null
  if (!name) return null
  return (
    <span data-icon={k} className="inline-flex">
      <MaterialIcon name={name} size="20" color="currentColor" />
    </span>
  )
}

/* ====================================================================== 6 PROOF */

function Proof({ page, company }: { page: CompetitorComparisonPage; company: string }) {
  const quotes = [
    page.testimonial1 && { q: page.testimonial1, who: page.testimonial1JobTitle, co: page.testimonial1Company },
    page.testimonial2 && { q: page.testimonial2, who: page.testimonial2JobTitle, co: page.testimonial2Company },
  ].filter(Boolean) as Array<{ q: string; who: string | null; co: string | null }>
  const field = useShowsField()
  const tile = (name: string, url: string | null) => (
    <CompanyBlock
      CompanyName={name}
      LogoMark={url ? { item: { __typename: 'cmp_PublicImageAsset', Url: url } } : null}
      displaySettings={{ variant: 'large', colorScheme: 'white' }}
    />
  )
  return (
    <Scene id="proof">
      <div className="mb-[min(5vh,48px)] text-center">
        <Reveal i={0}>
          <Eyebrow className="justify-center">Proof it works</Eyebrow>
        </Reveal>
        <Reveal i={1}>
          <Heading text="Teams like yours made the move" align="center" />
        </Reveal>
      </div>
      {/* The x-ray hook sits on the frame: the scrolling track inside is several screens wide. */}
      <Reveal i={2} data-xray="logo-wall" className="mb-[min(6vh,56px)]" {...field('logoWallCustomerSlot')}>
        <CarouselLogosClient>
          {[
            ...PROOF_LOGOS.slice(0, 3).map((l) => <div key={l.alt}>{tile(l.alt, l.url)}</div>),
            <div key="you" className="www-you-tile">
              {tile(page.logoWallCustomerSlot || `${company}?`, page.customerLogo)}
            </div>,
            ...PROOF_LOGOS.slice(3).map((l) => <div key={l.alt}>{tile(l.alt, l.url)}</div>),
          ]}
        </CarouselLogosClient>
      </Reveal>
      {quotes.length > 0 && (
        <div className="mx-auto grid max-w-[1000px] justify-items-center gap-3 md:grid-cols-2">
          {quotes.map((t, i) => (
            <Reveal key={i} i={3 + i} data-xray="testimonials" className="www-quote w-full" {...field(`testimonial${i + 1}`)}>
              <PortraitTextQuoteCard
                Badge="Customer story"
                Quote={`“${t.q}”`}
                AuthorName={t.who}
                AuthorTitle={t.co}
                cardColor="primary_3"
              />
            </Reveal>
          ))}
        </div>
      )}
    </Scene>
  )
}

/* =================================================================== 7 ANALYSTS */

function Analysts({ page }: { page: CompetitorComparisonPage }) {
  const cards = page.analystCards ?? []
  const field = useShowsField()
  if (!page.analystHeadline && !page.analystQuote && !cards.length) return null
  return (
    <Scene id="analysts">
      <div className="grid gap-[min(5vh,48px)] lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-5">
          <Reveal i={0}>
            <Eyebrow>Analyst recognition</Eyebrow>
          </Reveal>
          <Reveal i={1} {...field('analystHeadline')}>
            <Heading text={page.analystHeadline || 'What analysts say'} />
          </Reveal>
          {page.analystCTA && page.analystCTALink?.default && (
            <Reveal i={2} className="mt-8">
              <Button asChild variant="dark" className="www-btn">
                <a href={page.analystCTALink.default} target="_blank" rel="noopener noreferrer" {...field('analystCTA')}>
                  {page.analystCTA}
                </a>
              </Button>
            </Reveal>
          )}
        </div>
        {page.analystQuote && (
          <Reveal i={2} as="figure" data-xray="analysts" className="www-card www-card--neutral lg:col-span-7">
            <blockquote className="www-quote-text" {...field('analystQuote')}>
              “{page.analystQuote}”
            </blockquote>
            {page.analystSource && (
              <figcaption className="www-caption mt-5" {...field('analystSource')}>
                {page.analystSource}
              </figcaption>
            )}
          </Reveal>
        )}
      </div>
      {cards.length > 0 && (
        <div className={cn('mt-3 grid gap-3', cards.length >= 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3')} {...field('analystCards')}>
          {cards.map((c, i) => (
            <Reveal key={i} i={3 + i} data-xray="analysts">
              <CardArrowCard headline={`${c.Badge}: ${c.Category}`} description={c.Source} href={c.Url?.default || null} colorScheme="white" />
            </Reveal>
          ))}
        </div>
      )}
    </Scene>
  )
}

/* ================================================================== 8 STATEMENT */

function Statement({ page }: { page: CompetitorComparisonPage }) {
  const field = useShowsField()
  if (!page.promoHeading) return null
  return (
    <Scene id="promo" tone="neutral" innerClassName="text-center" attrs={{ 'data-xray': 'promo' }}>
      <Reveal i={0} {...field('promoEyebrow')}>
        <Eyebrow className="justify-center">{page.promoEyebrow}</Eyebrow>
      </Reveal>
      <Reveal i={1} {...field('promoHeading')}>
        <Heading text={page.promoHeading} size="display" align="center" className="mx-auto max-w-[18ch]" />
      </Reveal>
      {page.promoDescription && (
        <Reveal i={2} as="p" className="www-lead mx-auto mt-6 max-w-[52ch]" {...field('promoDescription')}>
          {page.promoDescription}
        </Reveal>
      )}
      {page.promoCTA && (
        <Reveal i={3} className="mt-8">
          <Button asChild variant="primary" className="www-btn">
            <a href={localHref(page.promoCTALink?.default)} {...field('promoCTA')}>
              {page.promoCTA}
            </a>
          </Button>
        </Reveal>
      )}
    </Scene>
  )
}

/* ======================================================================== 9 ROI */

function Roi({ page }: { page: CompetitorComparisonPage }) {
  const cards = page.roiCards ?? []
  const field = useShowsField()
  if (!page.roiTitle && !cards.length && !page.endHeadline) return null
  return (
    <Scene id="roi">
      <div className="grid gap-[min(5vh,48px)] lg:grid-cols-12 lg:items-end lg:gap-12">
        <div className="lg:col-span-6" data-xray="roi-heading">
          <Reveal i={0}>
            <Eyebrow>Your team&apos;s impact</Eyebrow>
          </Reveal>
          <Reveal i={1} {...field('roiTitle')}>
            <Heading text={page.roiTitle || 'The impact'} />
          </Reveal>
          {page.roiDescription && (
            <Reveal i={2} as="p" className="www-lead mt-4" {...field('roiDescription')}>
              {page.roiDescription}
            </Reveal>
          )}
        </div>
        {page.roiProjectionValue && (
          // The page's one extruded moment (brand rule: one heroic moment per design).
          <Reveal i={2} data-xray="roi-projection" className="www-roi-hero lg:col-span-6" {...field('roiProjectionValue')}>
            <StatBlock
              StatValue={page.roiProjectionValue}
              StatDescription={page.roiProjectionLabel}
              displaySettings={{ alignment: 'horizontal', animationMode: 'scroll' }}
            />
            {page.roiProjectionDetail && (
              <p className="www-small mt-3 px-2" {...field('roiProjectionDetail')}>
                {page.roiProjectionDetail}
              </p>
            )}
          </Reveal>
        )}
      </div>
      {cards.length > 0 && (
        <dl className={cn('www-stats mt-[min(6vh,56px)]', cards.length >= 4 && 'www-stats--4')} {...field('roiCards')}>
          {cards.map((c, i) => (
            <Reveal key={i} i={3 + i} data-xray="roi-cards" className="www-stat">
              <dt className="sr-only">{c.Label}</dt>
              <dd className="www-number">
                <CountUp value={c.Metric} />
                {c.Unit && <Unit unit={c.Unit} />}
              </dd>
              <dd className="www-body">{c.Label}</dd>
              {c.CitationText && <dd className="www-caption mt-2">{citation(c.CitationText)}</dd>}
            </Reveal>
          ))}
        </dl>
      )}
      {page.endHeadline && (
        <Reveal i={8} data-xray="end-cta" className="www-card www-card--neutral mt-[min(6vh,56px)] flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="www-h3" {...field('endHeadline')}>
              {page.endHeadline}
            </p>
            {page.endSubheadline && (
              <p className="www-body mt-1" {...field('endSubheadline')}>
                {page.endSubheadline}
              </p>
            )}
          </div>
          {page.endCTA && (
            <Button asChild variant="dark" className="www-btn shrink-0">
              <a href={localHref(page.endCTALink?.default)} {...field('endCTA')}>
                {page.endCTA}
              </a>
            </Button>
          )}
        </Reveal>
      )}
    </Scene>
  )
}

/** A symbol stays with its number at full size ("26%"); a word unit sits smaller beside it ("1 sec"). */
function Unit({ unit }: { unit: string }) {
  const u = unit.trim()
  if (/^[%+x×]$/i.test(u)) return <>{u}</>
  return <span className="www-number__unit"> {u}</span>
}

/** "De Mandemakers Groep customer story, https://…" → the source with its link. */
function citation(text: string) {
  const m = text.match(/^(.*?),?\s*(https?:\/\/\S+)\s*$/)
  if (!m) return text
  return (
    <a href={m[2]} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
      {m[1] || m[2]}
    </a>
  )
}

/* ======================================================================= 10 PATH */

function Path({ page }: { page: CompetitorComparisonPage }) {
  const phases = page.timelinePhases ?? []
  const field = useShowsField()
  if (!page.migrationTitle && !phases.length) return null
  return (
    <Scene id="migration">
      <div className="mb-[min(6vh,56px)] max-w-[760px]" data-xray="path-heading">
        <Reveal i={0}>
          <Eyebrow>The path forward</Eyebrow>
        </Reveal>
        <Reveal i={1} {...field('migrationTitle')}>
          <Heading text={page.migrationTitle || 'The path forward'} />
        </Reveal>
        {page.migrationDescription && (
          <Reveal i={2} as="p" className="www-lead mt-4" {...field('migrationDescription')}>
            {page.migrationDescription}
          </Reveal>
        )}
      </div>
      {phases.length > 0 && (
        <Steps
          steps={phases.map((p, i) => ({ label: p.Weeks || `Phase ${i + 1}`, title: p.Title, body: p.Description, attrs: field('timelinePhases') }))}
          xray="timeline-phases"
        />
      )}
    </Scene>
  )
}

/* ======================================================================== 11 ASK */

/** The sticky bar's button is the same one-click ask as the closing scene's. */
function StickyAsk({ text }: { text: string }) {
  const { connect } = useConnect()
  return <StickyCta text={text} onAction={() => connect('sticky-connect-btn')} />
}

function Ask({ page, team }: { page: CompetitorComparisonPage; team: TeamMember[] }) {
  const { connect, sent } = useConnect()
  const field = useShowsField()
  return (
    <section id="cta" data-scene data-tone="dark" className="www-scene www-scene--dark www-scene--fill">
      <div id="form" className="www-scene__inner vb-container mx-auto w-full px-4 lg:px-8">
        <div className="grid gap-[min(6vh,56px)] lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7">
            <Reveal i={0} data-xray="cta-title" {...field('ctaTitle')}>
              <Heading text={richToStacked(page.ctaTitle) || "Let's build the next chapter together"} size="display" className="text-white" />
            </Reveal>
            {page.ctaDescription && (
              <Reveal i={1} as="p" data-xray="cta-description" className="www-lead mt-6 max-w-[48ch] text-white/85" {...field('ctaDescription')}>
                {page.ctaDescription}
              </Reveal>
            )}
            <Reveal i={2} className="mt-10">
              {sent ? (
                <div role="status" className="www-sent">
                  <MaterialIcon name="check_circle" size="32" />
                  <span>
                    <strong className="block">You&apos;re all set</strong>
                    We&apos;ve let the Optimizely team know you&apos;re interested.
                  </span>
                </div>
              ) : (
                // One call to action. "Schedule a call" (modalScheduleUrl) is in the panel it opens.
                <Button variant="primary" className="www-btn" id="cta-connect-btn" onClick={() => connect('cta-connect-btn')} {...field('ctaButtonText')}>
                  {page.ctaButtonText || 'Get in touch with your Optimizely team'}
                </Button>
              )}
              <p className="www-small mt-4 text-white/60">One click lets your team know. No form to fill in.</p>
            </Reveal>
          </div>
          <div className="lg:col-span-5 lg:self-end">
            <Reveal i={3}>
              <p className="www-eyebrow www-eyebrow--on-dark mb-4">Your Optimizely team</p>
            </Reveal>
            {team.length > 0 ? (
              <ul className="flex flex-col gap-2" role="list" {...field('teamMembers')}>
                {team.map((m, i) => (
                  <Reveal key={i} as="li" i={4 + i} data-xray="team-members">
                    <a href={m.Email ? `mailto:${m.Email}` : '#cta'} className="www-person">
                      <GravatarAvatar email={m.Email} initials={m.Initials} className="www-avatar" />
                      <span className="min-w-0 flex-1">
                        <span className="font-nudge block text-2xl leading-tight font-extrabold">{m.Name}</span>
                        <span className="www-small block text-white/70">{m.Role}</span>
                      </span>
                      {m.Email && <MaterialIcon name="mail" size="24" color="var(--color-primary-lfgreen)" />}
                    </a>
                  </Reveal>
                ))}
              </ul>
            ) : (
              <p className="www-body text-white/80">The Optimizely team assigned to your account.</p>
            )}
          </div>
        </div>
        <Colophon xray="small-print">
          {page.footerTagline && <span {...field('footerTagline')}>{page.footerTagline}</span>}
          {(page.footerLinks ?? []).map((l, i) => (
            <a key={i} href={l.Url?.default || '#'} target="_blank" rel="noopener noreferrer" {...field('footerLinks')}>
              {l.Text}
            </a>
          ))}
          {page.footerLegal && <span {...field('footerLegal')}>{page.footerLegal}</span>}
        </Colophon>
      </div>
    </section>
  )
}
