/**
 * Person page, www design: the 1:1 buyer page one level in from the account page
 * (`/<company>/<person>/`, the PersonPage type, 33 pages on 4 Nov 2026), on the account pages'
 * layout. The content model is untouched and every stored field has a place or a stated reason
 * not to (./person-content.ts PERSON_FIELDS).
 *
 * Order, as the August rebuild argued it, one idea per scene:
 *   1 hero       who it is for, once (their account's logo and the stored eyebrow), and the claim
 *   2 note       a note from their account executive, and where the conversation stands
 *   3 problem    what a seat like theirs is scored on
 *   4 operation  their business, as the reason the product matters
 *   5 practice   the product as a change to how their team works
 *   6 how        the mechanism, four steps, the same on every page
 *   7 proof      one cited number, and peers in the same seat
 *   8 working    why you're seeing this: their words, our assumptions, and how to correct them
 *   9 ask        the one-click ask (it tells the account executive) and the team
 *
 * `data-xray` hooks are what X-ray and Edit mode find (PERSON_XRAY_DEFAULTS, PERSON_EDIT); in the
 * CMS editor each stored field carries the SDK's on-page editing hook (./cms-edit.tsx).
 */
import type { PersonPage as PersonPageData } from '../lib/graph-types'
import { resolveUrl } from '../lib/graph-types'
import GravatarAvatar from '../components/GravatarAvatar'
import { Button } from '../vendor/www/components/_ui/button'
import { Badge } from '../vendor/www/components/_ui/badge'
import StatBlock from '../vendor/www/components/block/stat-block'
import { PortraitTextQuoteCard } from '../vendor/www/components/block/portrait-text-quote-card-block/portrait-text-quote-card'
import { MaterialIcon } from '../vendor/www/components/element/icon-element'
import { ConnectProvider, useConnect, type ConnectPerson } from './ConnectModal'
import { AccountMark, Card, Colophon, Eyebrow, Heading, HeroFrame, Initials, Reveal, Scene, Steps, StickyCta, WwwPage } from './ui'
import { SCENE } from './account-helpers'
import { useShowsField } from './cms-edit'
import {
  HOW_IT_WORKS,
  HOW_IT_WORKS_TITLE,
  PRODUCT_HREF,
  PRODUCT_LABEL,
  TIER_LABEL,
  askLabelOf,
  bookingUrlOf,
  formatDate,
  heroSecondHref,
  keyNumberText,
  measuresOf,
  peerProofOf,
  provenanceOf,
  teamOf,
} from './person-content'

interface Props {
  page: PersonPageData
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

/** What the connect panel shows: the team, and a booking link only when there is one. */
export function personConnectProps(page: PersonPageData): { people: ConnectPerson[]; scheduleUrl: string | null } {
  return {
    people: teamOf(page).map((m) => ({
      name: m.Name as string,
      role: m.Role || 'Optimizely',
      email: m.Email || null,
      initials: m.Initials || initialsOf(m.Name as string),
    })),
    scheduleUrl: bookingUrlOf(page),
  }
}

export default function PersonPage({ page }: Props) {
  const company = page.companyName?.trim() || 'your company'
  const person = page.personName?.trim() || 'you'
  return (
    <ConnectProvider {...personConnectProps(page)}>
      <WwwPage accent={page.brandAccentColor} className="www-person">
        <div id="main-content">
          <Hero page={page} company={company} person={person} />
          <Note page={page} />
          <Problem page={page} />
          <Operation page={page} company={company} />
          <Practice page={page} />
          <How />
          <Proof page={page} />
          <Working page={page} />
          <Ask page={page} company={company} />
        </div>
        <StickyAsk text={page.ctaTitle || `Written for ${person}`} />
      </WwwPage>
    </ConnectProvider>
  )
}

/* ======================================================================= 1 HERO */

function Hero({ page, company, person }: { page: PersonPageData; company: string; person: string }) {
  const field = useShowsField()
  const linkedIn = resolveUrl(page.personLinkedIn)
  return (
    <HeroFrame
      scene={SCENE}
      copy={
        <>
          {/* Whose page this is, once: their account's logo and the stored eyebrow, above the headline. */}
          <Reveal i={0} fx="scale">
            <AccountMark
              name={company}
              logo={resolveUrl(page.companyLogo)}
              label={page.heroEyebrow || `Written for ${person}`}
              xray="person-hero"
              accent={!!page.brandAccentColor}
              edit={{ logo: field('companyLogo'), label: field('heroEyebrow') }}
            />
          </Reveal>
          <Reveal i={1} data-xray="person-identity" {...field(page.heroHeadline ? 'heroHeadline' : 'personName')}>
            <Heading text={page.heroHeadline || person} level="h1" className="text-white" />
          </Reveal>
          <Reveal i={2} as="p" className="www-lead text-white/85" {...field(page.heroSubheadline ? 'heroSubheadline' : 'personTitle')}>
            {page.heroSubheadline || page.personTitle}
          </Reveal>
          {(page.roleFrame || linkedIn) && (
            <Reveal i={3} className="flex flex-wrap items-center gap-3">
              {page.roleFrame && (
                <span className="www-chip www-chip--on-dark" {...field('roleFrame')}>
                  {page.roleFrame}
                </span>
              )}
              {linkedIn && (
                <a href={linkedIn} target="_blank" rel="noopener noreferrer" className="www-link text-white" {...field('personLinkedIn')}>
                  LinkedIn<span className="sr-only"> profile of {person} (opens in new tab)</span>
                </a>
              )}
            </Reveal>
          )}
          <Reveal i={4} className="flex flex-wrap gap-3">
            <Button asChild variant="primary" className="www-btn">
              <a href="#cta">Talk to your team</a>
            </Button>
            {page.heroCtaText && (
              <Button asChild variant="white" className="www-btn">
                <a href={heroSecondHref(page)} data-xray="person-hero-cta" {...field('heroCtaText')}>
                  {page.heroCtaText}
                </a>
              </Button>
            )}
          </Reveal>
        </>
      }
    />
  )
}

/* ======================================================================= 2 NOTE */

function Note({ page }: { page: PersonPageData }) {
  const field = useShowsField()
  const tier = page.engagementTier ?? 'known'
  if (!page.noteBody) return null
  return (
    <Scene id="note" tone="neutral" compact>
      <div className="mx-auto max-w-[860px]" data-xray="person-opening">
        <Reveal i={0} className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Eyebrow>{page.noteSignedBy ? `A note from ${page.noteSignedBy.split(/\s+/)[0]}` : 'A note'}</Eyebrow>
          <span data-xray="person-tier" {...field('engagementTier')}>
            <Badge label={TIER_LABEL[tier]} color="darkgreen" filled={false} size="sm" />
          </span>
        </Reveal>
        <Reveal i={1} as="p" className="www-letter" {...field('noteBody')}>
          {page.noteBody}
        </Reveal>
        {page.noteSignedBy && (
          <Reveal i={2} className="mt-8 flex items-center gap-4">
            <span {...field('noteSignedByInitials')}>
              <Initials initials={page.noteSignedByInitials || initialsOf(page.noteSignedBy)} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="font-nudge block text-2xl leading-tight font-extrabold" {...field('noteSignedBy')}>
                {page.noteSignedBy}
              </span>
              {page.noteSignedByRole && (
                <span className="www-small block" {...field('noteSignedByRole')}>
                  {page.noteSignedByRole}
                </span>
              )}
            </span>
            {page.noteDate && (
              <time className="www-caption" dateTime={page.noteDate} {...field('noteDate')}>
                {formatDate(page.noteDate)}
              </time>
            )}
          </Reveal>
        )}
      </div>
    </Scene>
  )
}

/* ==================================================================== 3 PROBLEM */

function Problem({ page }: { page: PersonPageData }) {
  const field = useShowsField()
  const measures = measuresOf(page)
  if (!measures.length) return null
  const fromScorecard = (page.scorecard ?? []).length > 0
  return (
    <Scene id="problem">
      <Reveal i={0}>
        <Eyebrow>What the job is scored on</Eyebrow>
      </Reveal>
      <Reveal i={1} {...field(fromScorecard ? 'scorecardHeadline' : 'remitHeadline')}>
        <Heading text={(fromScorecard ? page.scorecardHeadline : page.remitHeadline) || 'Where this gets hard'} className="mb-[min(6vh,56px)] max-w-[24ch]" />
      </Reveal>
      <ol className="grid gap-3 md:grid-cols-2" role="list" {...field(fromScorecard ? 'scorecard' : 'remitPoints')}>
        {measures.map((m, i) => (
          <Reveal key={i} as="li" i={2 + i}>
            <Card xray="person-measures" className="flex h-full flex-col gap-3">
              <span className="www-caption" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="www-h3">{m.title}</h3>
              {m.note && <p className="www-body opacity-85">{m.note}</p>}
              {m.metric && <span className="www-chip www-chip--white mt-auto self-start">{m.metric}</span>}
            </Card>
          </Reveal>
        ))}
      </ol>
    </Scene>
  )
}

/* ================================================================== 4 OPERATION */

function Operation({ page, company }: { page: PersonPageData; company: string }) {
  const field = useShowsField()
  const { operation } = provenanceOf(page)
  if (!operation.length) return null
  return (
    <Scene id="operation" tone="neutral">
      <Reveal i={0}>
        <Eyebrow>Your operation</Eyebrow>
      </Reveal>
      <Reveal i={1}>
        <Heading text={`What ${company} is running today`} className="mb-[min(6vh,56px)] max-w-[24ch]" />
      </Reveal>
      <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" role="list" {...field('provenance')}>
        {operation.map((p, i) => {
          const src = resolveUrl(p.SourceUrl)
          return (
            <Reveal key={i} as="li" i={2 + i}>
              <Card tone="white" xray="person-operation" className="flex h-full flex-col gap-4">
                <p className="www-body">{p.Text}</p>
                {p.SourceLabel && (
                  <p className="www-caption mt-auto">
                    {src ? (
                      <a href={src} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                        {p.SourceLabel}
                        <span className="sr-only"> (opens in new tab)</span>
                      </a>
                    ) : (
                      p.SourceLabel
                    )}
                  </p>
                )}
              </Card>
            </Reveal>
          )
        })}
      </ul>
    </Scene>
  )
}

/* =================================================================== 5 PRACTICE */

function Practice({ page }: { page: PersonPageData }) {
  const field = useShowsField()
  const solutions = page.solutions ?? []
  if (!solutions.length) return null
  return (
    <Scene id="practice">
      <div className="mb-[min(6vh,56px)] max-w-[760px]">
        <Reveal i={0}>
          <Eyebrow>In practice</Eyebrow>
        </Reveal>
        <Reveal i={1} {...field('solutionsHeadline')}>
          <Heading text={page.solutionsHeadline || 'What changes for your team'} />
        </Reveal>
        {page.solutionsIntro && (
          <Reveal i={2} as="p" className="www-lead mt-4" {...field('solutionsIntro')}>
            {page.solutionsIntro}
          </Reveal>
        )}
      </div>
      <ul className="grid gap-3 lg:grid-cols-3" role="list" {...field('solutions')}>
        {solutions.map((s, i) => {
          const key = s.Product ?? ''
          const href = PRODUCT_HREF[key]
          return (
            <Reveal key={i} as="li" i={3 + i}>
              <Card xray="person-practice" className="flex h-full flex-col gap-3">
                <span className="self-start">
                  <Badge label={PRODUCT_LABEL[key] ?? (s.Product || 'Optimizely')} color="lfgreen" filled size="sm" />
                </span>
                <h3 className="www-h3">{s.Headline}</h3>
                {s.Body && <p className="www-body opacity-85">{s.Body}</p>}
                {s.WhyFirst && <p className="www-small border-secondary-darkfir/15 mt-auto border-t pt-3">{s.WhyFirst}</p>}
                {href && (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="www-link mt-1 self-start">
                    Product overview<span className="sr-only">: {PRODUCT_LABEL[key]} (opens in new tab)</span>
                  </a>
                )}
              </Card>
            </Reveal>
          )
        })}
      </ul>
    </Scene>
  )
}

/* ======================================================================== 6 HOW */

function How() {
  return (
    <Scene id="how" tone="neutral">
      <div className="mb-[min(6vh,56px)] max-w-[760px]">
        <Reveal i={0}>
          <Eyebrow>How it works</Eyebrow>
        </Reveal>
        <Reveal i={1}>
          <Heading text={HOW_IT_WORKS_TITLE} />
        </Reveal>
      </div>
      <Steps steps={HOW_IT_WORKS.map((s, i) => ({ label: `Step ${i + 1}`, title: s.title, body: s.body }))} xray="person-how" />
    </Scene>
  )
}

/* ====================================================================== 7 PROOF */

function Proof({ page }: { page: PersonPageData }) {
  const field = useShowsField()
  const peers = peerProofOf(page)
  const cite = resolveUrl(page.keyNumberCitationUrl)
  if (!page.keyNumberValue && !peers.length) return null
  return (
    <Scene id="proof">
      <Reveal i={0}>
        <Eyebrow>Proof it works</Eyebrow>
      </Reveal>
      <Reveal i={1} {...field('peerProofHeadline')}>
        <Heading text={page.peerProofHeadline || 'Others who hold a seat like yours'} className="mb-[min(6vh,56px)] max-w-[24ch]" />
      </Reveal>
      {page.keyNumberValue && (
        <div className="mb-[min(6vh,56px)] grid gap-[min(4vh,40px)] lg:grid-cols-12 lg:items-center lg:gap-12">
          {/* The page's one extruded moment (brand rule: one heroic moment per design): the number and what it is. */}
          <Reveal i={2} data-xray="person-number" className="www-roi-hero lg:col-span-7" {...field('keyNumberValue')}>
            <StatBlock
              StatValue={keyNumberText(page)}
              StatDescription={page.keyNumberLabel}
              displaySettings={{ alignment: 'horizontal', animationMode: 'scroll' }}
            />
          </Reveal>
          {page.keyNumberDetail && (
            <Reveal i={3} as="p" className="www-body lg:col-span-5" {...field('keyNumberDetail')}>
              {page.keyNumberDetail}
              {cite && (
                <>
                  {' '}
                  <a href={cite} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" {...field('keyNumberCitationUrl')}>
                    Source<span className="sr-only"> (opens in new tab)</span>
                  </a>
                </>
              )}
            </Reveal>
          )}
        </div>
      )}
      {peers.length > 0 && (
        <div className={peers.length > 1 ? 'mx-auto grid max-w-[1000px] gap-3 md:grid-cols-2' : 'mx-auto grid max-w-[560px]'} {...field('peerProof')}>
          {peers.map((p, i) => {
            const src = resolveUrl(p.SourceUrl)
            return (
              <Reveal key={i} i={4 + i} data-xray="person-proof" className="www-quote w-full">
                <PortraitTextQuoteCard
                  Badge="Customer story"
                  Quote={`“${p.Quote}”`}
                  AuthorName={p.PersonName}
                  AuthorTitle={[p.PersonTitle, p.Company].filter(Boolean).join(', ')}
                  cardColor="primary_3"
                />
                {src && (
                  <a href={src} target="_blank" rel="noopener noreferrer" className="www-link mt-3 inline-block">
                    Read the story<span className="sr-only">: {p.Company} (opens in new tab)</span>
                  </a>
                )}
              </Reveal>
            )
          })}
        </div>
      )}
    </Scene>
  )
}

/* ==================================================================== 8 WORKING */

function Working({ page }: { page: PersonPageData }) {
  const field = useShowsField()
  const { working } = provenanceOf(page)
  if (!working.length) return null
  return (
    <Scene id="working" tone="neutral" compact>
      <div className="mx-auto max-w-[860px]" data-xray="person-working">
        <Reveal i={0}>
          <Eyebrow>Why you&rsquo;re seeing this</Eyebrow>
        </Reveal>
        <ul className="mt-6 flex flex-col gap-4" role="list" {...field('provenance')}>
          {working.map((p, i) => {
            const assumed = (p.Register ?? 'assumed') === 'assumed'
            const src = resolveUrl(p.SourceUrl)
            return (
              <Reveal key={i} as="li" i={1 + i} className="grid gap-1 md:grid-cols-[160px_1fr] md:gap-6" data-register={p.Register ?? 'assumed'}>
                {/* "You said", not "You told us": a line from a published interview is theirs too. */}
                <span className="www-caption pt-1">{assumed ? 'We assumed' : 'You said'}</span>
                <span className="www-body">
                  {p.Text}
                  {p.SourceLabel && !assumed && (
                    <span className="www-small">
                      {' '}
                      ({src ? (
                        <a href={src} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                          {p.SourceLabel}
                          <span className="sr-only"> (opens in new tab)</span>
                        </a>
                      ) : (
                        p.SourceLabel
                      )})
                    </span>
                  )}
                </span>
              </Reveal>
            )
          })}
        </ul>
        <Reveal i={2 + working.length} as="p" className="www-small mt-6">
          If any of that is wrong, tell {page.noteSignedBy || 'us'} and we&rsquo;ll rewrite it.
        </Reveal>
      </div>
    </Scene>
  )
}

/* ======================================================================== 9 ASK */

/** The sticky bar's button is the same one-click ask as the closing scene's. */
function StickyAsk({ text }: { text: string }) {
  const { connect } = useConnect()
  return <StickyCta text={text} onAction={() => connect('sticky-connect-btn')} />
}

function Ask({ page, company }: { page: PersonPageData; company: string }) {
  const { connect, sent } = useConnect()
  const field = useShowsField()
  const team = teamOf(page)
  return (
    <section id="cta" data-scene data-tone="dark" className="www-scene www-scene--dark www-scene--fill">
      <div className="www-scene__inner vb-container mx-auto w-full px-4 lg:px-8">
        <div className="grid gap-[min(6vh,56px)] lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7">
            <Reveal i={0} data-xray="person-cta" {...field('ctaTitle')}>
              <Heading text={page.ctaTitle || 'Where would you like to start?'} size="display" className="text-white" />
            </Reveal>
            {page.ctaBody && (
              <Reveal i={1} as="p" className="www-lead mt-6 max-w-[48ch] text-white/85" {...field('ctaBody')}>
                {page.ctaBody}
              </Reveal>
            )}
            <Reveal i={2} className="mt-10">
              {sent ? (
                <div role="status" className="www-sent">
                  <MaterialIcon name="check_circle" size="32" />
                  <span>
                    <strong className="block">You&apos;re all set</strong>
                    We&apos;ve let your Optimizely team know.
                  </span>
                </div>
              ) : (
                // One call to action: the one-click ask. A booking link, when there is one, is in the panel it opens.
                <Button variant="primary" className="www-btn" id="cta-connect-btn" onClick={() => connect('cta-connect-btn')} {...field('ctaButtonText')}>
                  {askLabelOf(page)}
                </Button>
              )}
              <p className="www-small mt-4 text-white/60">One click lets your team know. No form to fill in.</p>
            </Reveal>
          </div>
          <div className="lg:col-span-5 lg:self-end">
            <Reveal i={3}>
              <p className="www-eyebrow www-eyebrow--on-dark mb-4" {...field('teamHeadline')}>
                {page.teamHeadline || 'Your Optimizely team'}
              </p>
            </Reveal>
            {team.length > 0 ? (
              <ul className="flex flex-col gap-2" role="list" data-xray="person-team" {...field('team')}>
                {team.map((m, i) => (
                  <Reveal key={i} as="li" i={4 + i}>
                    <a href={m.Email ? `mailto:${m.Email}` : '#cta'} className="www-person">
                      <GravatarAvatar email={m.Email} initials={m.Initials || initialsOf(m.Name as string)} className="www-avatar" />
                      <span className="min-w-0 flex-1">
                        <span className="font-nudge block text-2xl leading-tight font-extrabold">{m.Name}</span>
                        <span className="www-small block text-white/70">
                          {m.Role}
                          {m.AlreadyMet && <span className="www-met"> · You have met</span>}
                        </span>
                      </span>
                      {m.Email && <MaterialIcon name="mail" size="24" color="var(--color-primary-lfgreen)" />}
                    </a>
                  </Reveal>
                ))}
              </ul>
            ) : (
              <p className="www-body text-white/80">The Optimizely team on your account.</p>
            )}
          </div>
        </div>
        <Colophon xray="person-small-print">
          {page.footerLine && <span {...field('footerLine')}>{page.footerLine}</span>}
          {page.companySlug && <a href={`/${page.companySlug}/`}>Back to {company}</a>}
        </Colophon>
      </div>
    </section>
  )
}
