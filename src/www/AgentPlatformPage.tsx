/**
 * The agent platform account page (Laura Perez Riau's template, from Dan Tranter's pitch,
 * 27 October 2026): Optimizely as the layer on top of the stack the account already runs, not a
 * replacement for it. Eight sections, in her order:
 *
 *   1 hero              who we are → what agents do for them → their situation as the reason
 *   2 who we are        the same on every page
 *   3 where it fits     their numbers, then teams / agent platform / their stack
 *   4 speaks your language  one leadership question; generic AI vs the agent platform
 *   5 use cases         two priority cards and a strip of three, from the five themes
 *   6 proof             three verified results (track B) or three reads (track A)
 *   7 first 90 days     Connect · Teach · Launch · Scale, nothing replaced
 *   8 close             headline by state, three reasons, rep or team pod, exactly two CTAs
 *
 * Look, headline, proof track, rep visibility and CTAs follow the lifecycle state. Content comes
 * from `AgentPlatformContent` (./agent-platform/content.ts); `?review=1` shows where each part
 * came from (the build-logic layer, never in production output).
 */
import type { CompetitorComparisonPage } from '../lib/graph-types'
import { useOdpTracking } from '../hooks/useOdpTracking'
import { Button } from '../vendor/www/components/_ui/button'
import { Badge } from '../vendor/www/components/_ui/badge'
import { MaterialIcon } from '../vendor/www/components/element/icon-element'
import { cn } from '../vendor/www/lib/utils'
import { Colophon, CountUp, Eyebrow, Heading, Reveal, Scene, StickyCta, TopStrip, WwwPage } from './ui'
import { ConnectProvider, useConnect } from './ConnectModal'
import { SCENE } from './account-helpers'
import {
  FIRST_90_DAYS,
  GOVERNANCE_LINE,
  IDENTITY_SENTENCE,
  PLATFORM_LAYER,
  PROOF_ASSETS,
  PROOF_STORIES,
  STATES,
  THEMES,
  TRUST_CENTER,
  USE_CASES_CLOSING_LINE,
  WHO_WE_ARE,
  type ThemeId,
} from './agent-platform/library'
import { fromLegacyPage, STATE_IDS, type AgentPlatformContent } from './agent-platform/content'
import type { LifecycleState } from './agent-platform/library'

export default function AgentPlatformPage({ page, search = '' }: { page: CompetitorComparisonPage; search?: string }) {
  useOdpTracking('abm')
  const params = new URLSearchParams(search)
  const c = fromLegacyPage(page, { state: params.get('state') as LifecycleState | null })
  const review = params.get('review') === '1'
  const st = STATES[c.state.value]
  const people = c.rep.value.named
  return (
    <ConnectProvider page={page} people={people} scheduleUrl={c.scheduleUrl} teamLabel="your Optimizely account team">
      <WwwPage className="www-ap">
        <div id="main-content">
          <Hero c={c} />
          <WhoWeAre />
          <WhereItFits c={c} />
          <SpeaksYourLanguage c={c} />
          <UseCases c={c} />
          <Proof c={c} />
          <FirstNinetyDays c={c} />
          <Close c={c} />
        </div>
        <StickyAsk text={c.stickyText} label={ctaLabel(st.primaryCta, people)} />
        {review && <ReviewLayer c={c} search={search} />}
      </WwwPage>
    </ConnectProvider>
  )
}

/** "Arrange a session" becomes "Arrange a session with Neal" when the page may name the rep. */
function ctaLabel(base: string, people: Array<{ name: string }>) {
  return base === 'Arrange a session' && people.length ? `${base} with ${people[0].name.split(/\s+/)[0]}` : base
}

function fill(s: string, c: AgentPlatformContent, lead?: ThemeId) {
  return s.replaceAll('{account}', c.account).replaceAll('{lead}', lead ? THEMES[lead].lead : '')
}

/* ======================================================================= HERO */

function Hero({ c }: { c: AgentPlatformContent }) {
  const st = STATES[c.state.value]
  const { connect } = useConnect()
  const lead = c.themes.value[0]
  const second = c.themes.value[1]
  const tasks = [...THEMES[lead].tasks.slice(0, 2), THEMES[second].tasks[0], THEMES[lead].tasks[3]]
  const chips = c.stack.value.filter((t) => !t.ours).slice(0, 4)
  const dark = st.look === 'darkfir'
  return (
    <section id="hero" data-scene className="www-hero is-in">
      <TopStrip account={{ name: c.account, logo: c.logo }} />
      <div className="vb-container mx-auto w-full px-3 lg:px-6">
        <div className={cn('www-hero__card', `www-hero__card--${st.look}`)} data-state={c.state.value}>
          <div className="www-hero__copy">
            <Reveal i={0}>
              <p className={cn('www-eyebrow', dark && 'www-eyebrow--on-dark')}>Personalized for {c.account}</p>
            </Reveal>
            <Reveal i={1} data-xray="hero-title">
              {/* Laura's state headlines are sentences, not slogans: one step down from display size. */}
              <Heading text={st.h1} level="h1" size="h2" extrude />
            </Reveal>
            <Reveal i={2} as="p" data-xray="hero-subtitle" className={cn('www-lead', dark ? 'text-white/85' : '')}>
              {IDENTITY_SENTENCE} {fill(st.sub, c, lead)}
            </Reveal>
            {c.pills.value.length > 0 && (
              <Reveal i={3} as="div" data-xray="intel-stats" className="flex flex-wrap gap-2">
                {c.pills.value.map((p) => (
                  <span key={p} className={cn('www-pill', dark && 'www-pill--on-dark')}>
                    {p}
                  </span>
                ))}
              </Reveal>
            )}
            <Reveal i={4} className="flex flex-wrap gap-3">
              <Button variant="primary" className="www-btn" id="hero-connect-btn" onClick={() => connect('hero-connect-btn')}>
                {ctaLabel(st.primaryCta, c.rep.value.named)}
              </Button>
              <Button asChild variant={dark ? 'white' : 'dark'} className="www-btn">
                <a href="#usecases">See where agents start</a>
              </Button>
            </Reveal>
          </div>
          <Reveal i={2} className="www-hero__visual">
            <picture>
              <source type="image/avif" srcSet={`${SCENE}-960.avif 960w, ${SCENE}-1600.avif 1600w`} sizes="(min-width: 992px) 50vw, 100vw" />
              <img src={`${SCENE}-960.webp`} alt="" className="absolute inset-0 size-full object-cover" loading="eager" decoding="async" />
            </picture>
            <div className="www-agents" data-xray="agents-at-work">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 font-semibold">
                  <MaterialIcon name="bolt" size="20" /> Agents at work for {c.account}
                </p>
                <span className="www-caption">Illustrative</span>
              </div>
              <ul className="mt-4 flex flex-col gap-2.5" role="list">
                {tasks.map((t, i) => (
                  <li key={t} className="www-agents__task">
                    {i < 3 ? (
                      <MaterialIcon name="check_circle" size="20" color="var(--www-good)" />
                    ) : (
                      <span className="www-agents__live" aria-hidden="true" />
                    )}
                    <span>
                      {t}
                      {i === 3 && <span className="sr-only"> (in progress)</span>}
                    </span>
                  </li>
                ))}
              </ul>
              {chips.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {chips.map((t) => (
                    <span key={t.label} className="www-agents__chip">
                      {t.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ================================================================= WHO WE ARE */

function WhoWeAre() {
  return (
    <Scene id="who">
      <div data-xray="who-we-are">
        <Reveal i={0}>
          <Eyebrow>Who we are</Eyebrow>
        </Reveal>
        <Reveal i={1}>
          <Heading text={WHO_WE_ARE.heading} className="max-w-[20ch]" />
        </Reveal>
        <div className="mt-[min(6vh,56px)] grid gap-3 md:grid-cols-3">
          {WHO_WE_ARE.tiles.map((t, i) => (
            <Reveal key={t.title} i={2 + i} className={cn('www-card', t.lead ? 'www-card--lime' : 'www-card--neutral')}>
              <span className="www-icon-tile www-icon-tile--white">
                <MaterialIcon name={t.icon} size="24" />
              </span>
              <h3 className="www-h3 mt-5">{t.title}</h3>
              <p className="www-body mt-2">{t.body}</p>
            </Reveal>
          ))}
        </div>
        <Reveal i={5} className="mt-3 grid gap-3 md:grid-cols-3">
          {WHO_WE_ARE.analysts.map((a) => (
            <a key={a.name} href={a.href} target="_blank" rel="noopener noreferrer" className="www-analyst">
              <Badge label={a.badge} color={a.badge === 'Leader' ? 'lfgreen' : 'darkgreen'} filled={a.badge === 'Leader'} size="sm" />
              <span className="www-body">{a.name}</span>
              <MaterialIcon name="arrow_outward" size="20" />
              <span className="sr-only"> (opens in new tab)</span>
            </a>
          ))}
        </Reveal>
        <Reveal i={6} as="p" className="www-caption mt-5">
          {WHO_WE_ARE.usage.text}{' '}
          <a href={WHO_WE_ARE.usage.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {WHO_WE_ARE.usage.source}
          </a>
        </Reveal>
      </div>
    </Scene>
  )
}

/* ============================================================== WHERE IT FITS */

function WhereItFits({ c }: { c: AgentPlatformContent }) {
  const stats = c.stats.value
  return (
    <Scene id="intel" tone="neutral">
      <div className="grid gap-[min(5vh,48px)] lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-5">
          <Reveal i={0}>
            <Eyebrow>We did our homework</Eyebrow>
          </Reveal>
          <Reveal i={1} data-xray="intel-headline">
            <Heading text="Keep your stack. Add the layer that ##connects it##." />
          </Reveal>
          <Reveal i={2} as="p" className="www-lead mt-4">
            Each tool does one job well. Agents read across all of them and act, with your team approving.
          </Reveal>
          {stats.length > 0 && (
            <dl className="www-fit-stats mt-[min(5vh,40px)]">
              {stats.map((s, i) => (
                <Reveal key={s.label} i={3 + i} data-xray="intel-stats" className="www-fit-stat">
                  <dt className="www-small order-2">{s.label}</dt>
                  <dd className="www-number order-1">{/^(1[89]|20)\d{2}$/.test(s.value) ? s.value : <CountUp value={s.value} />}</dd>
                </Reveal>
              ))}
            </dl>
          )}
          {c.statsSource.value && (
            <p className="www-caption mt-3">
              Source:{' '}
              <a href={c.statsSource.value.href} target="_blank" rel="noopener noreferrer" className="underline">
                {c.statsSource.value.label}
              </a>
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 lg:col-span-7">
          <Reveal i={3} className="www-layer www-layer--teams">
            <p className="www-layer__label">Your teams</p>
            <div className="flex flex-wrap gap-2">
              {c.teams.value.map((t) => (
                <span key={t} className="www-chip">
                  {t}
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal i={4} className="www-layer__arrow" aria-hidden="true">
            <MaterialIcon name="swap_vert" size="24" />
          </Reveal>
          <Reveal i={5} className="www-layer www-layer--platform">
            <p className="www-layer__label">
              <MaterialIcon name="bolt" size="18" /> Agent platform
            </p>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_LAYER.map((p) => (
                <span key={p.label} className="www-chip www-chip--on-dark">
                  <MaterialIcon name={p.icon} size="18" /> {p.label}
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal i={6} className="www-layer__arrow" aria-hidden="true">
            <MaterialIcon name="swap_vert" size="24" />
          </Reveal>
          <Reveal i={7} className="www-layer www-layer--stack" data-xray="tech-stack">
            <p className="www-layer__label">What {c.account} runs today</p>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="list">
              {c.stack.value.map((t) => (
                <li key={t.label} className={cn('www-tile', t.ours && 'www-tile--ours')}>
                  {/* A competitor tile already reads as its category ("Your CMS"). */}
                  {!t.competitor && <span className="www-caption">{t.category}</span>}
                  <span className="font-semibold">{t.label}</span>
                  {t.ours && <span className="www-tile__ours">Optimizely</span>}
                </li>
              ))}
            </ul>
          </Reveal>
          {c.priorities.value.length > 0 && (
            <Reveal i={8} className="mt-3" data-xray="investments">
              <p className="www-caption mb-2">Where {c.account} is investing</p>
              <div className="flex flex-wrap gap-2">
                {c.priorities.value.map((p) => (
                  <span key={p} className="www-chip www-chip--white">
                    {p}
                  </span>
                ))}
              </div>
            </Reveal>
          )}
          {c.quote.value && (
            <Reveal i={9} as="figure" className="www-card www-card--white mt-3">
              <blockquote className="www-quote-text">“{c.quote.value.text}”</blockquote>
              <figcaption className="www-caption mt-3">{c.quote.value.who}</figcaption>
              <p className="www-body mt-3">Optimizely applies the same idea to the marketing that tells that story.</p>
            </Reveal>
          )}
        </div>
      </div>
    </Scene>
  )
}

/* ======================================================= SPEAKS YOUR LANGUAGE */

function SpeaksYourLanguage({ c }: { c: AgentPlatformContent }) {
  const lead = THEMES[c.themes.value[0]]
  return (
    <Scene id="language">
      <div data-xray="speaks-language" className="mx-auto max-w-[1000px]">
        <Reveal i={0}>
          <Eyebrow>Speaks your language</Eyebrow>
        </Reveal>
        <Reveal i={1}>
          <Heading text={`Generic AI guesses. Ours starts from how ${c.account} works.`} className="max-w-[22ch]" />
        </Reveal>
        <Reveal i={2} className="www-ask mt-[min(5vh,40px)]">
          <span className="www-ask__who" aria-hidden="true">
            <MaterialIcon name="person" size="22" />
          </span>
          <p className="www-ask__q">“{c.question.value}”</p>
        </Reveal>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Reveal i={3} className="www-card www-card--neutral">
            <p className="www-caption">A generic AI tool</p>
            <p className="www-lead mt-3 opacity-80">“Paste in your campaign data and I&apos;ll summarize it for you.”</p>
          </Reveal>
          <Reveal i={4} className="www-card www-card--dark">
            <p className="www-caption flex items-center gap-1 text-white">
              <MaterialIcon name="bolt" size="18" /> Optimizely agent platform
            </p>
            <ul className="mt-3 flex flex-col gap-2" role="list">
              {lead.checks.map((k) => (
                <li key={k} className="www-body flex items-start gap-2">
                  <MaterialIcon name="check" size="20" color="var(--color-primary-lfgreen)" /> {k}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </Scene>
  )
}

/* ================================================================== USE CASES */

function UseCases({ c }: { c: AgentPlatformContent }) {
  const [a, b, ...rest] = c.themes.value
  const customer = c.state.value === 'customer'
  return (
    <Scene id="usecases" tone="neutral">
      <div data-xray="use-cases">
        <div className="mb-[min(5vh,40px)] max-w-[760px]">
          <Reveal i={0}>
            <Eyebrow>Where agents start</Eyebrow>
          </Reveal>
          <Reveal i={1}>
            <Heading text={`Same platform. A starting point only ${c.account} would pick.`} />
          </Reveal>
          <Reveal i={2} as="p" className="www-lead mt-4">
            For {c.account}, these two come first.
          </Reveal>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {[a, b].map((id, i) => {
            const t = THEMES[id]
            const obs = c.observed.value[id]
            return (
              <Reveal key={id} i={3 + i} className="www-card www-card--white www-usecase">
                <div className="flex items-center justify-between gap-3">
                  <span className="www-icon-tile">
                    <MaterialIcon name={t.icon} size="26" />
                  </span>
                  <Badge label={`Priority · ${t.name}`} color="lfgreen" filled size="sm" />
                </div>
                {obs && (
                  <p className="www-small mt-5">
                    <span className="www-caption block">Observed</span>
                    {obs.text}{' '}
                    <a href={obs.href} target="_blank" rel="noopener noreferrer" className="underline">
                      Source
                    </a>
                  </p>
                )}
                <h3 className="www-h3 mt-5">{c.jobs.value[id] ?? t.job}</h3>
                <p className="www-body mt-2">{t.body}</p>
                <p className="www-caption mt-4">Measured on: {t.measuredOn}</p>
                <p className="www-small mt-auto pt-4 font-medium">Enabled by {t.enabledBy}</p>
              </Reveal>
            )
          })}
        </div>
        <Reveal i={5} className="mt-[min(4vh,32px)]">
          <p className="www-caption mb-3">{customer ? 'Next on your roadmap' : 'Also on the same platform'}</p>
          <div className="grid gap-3 md:grid-cols-3">
            {rest.slice(0, 3).map((id) => (
              <div key={id} className="www-card www-card--white flex items-start gap-3">
                <MaterialIcon name={THEMES[id].icon} size="24" />
                <div>
                  <p className="font-semibold">{THEMES[id].strip.title}</p>
                  <p className="www-small mt-1">{THEMES[id].strip.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
        <Reveal i={6} as="p" className="www-lead mt-[min(4vh,32px)] max-w-[52ch]">
          {USE_CASES_CLOSING_LINE}
        </Reveal>
      </div>
    </Scene>
  )
}

/* ====================================================================== PROOF */

function Proof({ c }: { c: AgentPlatformContent }) {
  const trackB = STATES[c.state.value].proofTrack === 'B'
  return (
    <Scene id="proof">
      <div data-xray="proof-stories">
        <Reveal i={0}>
          <Eyebrow>{trackB ? 'Proof it works' : 'Worth reading'}</Eyebrow>
        </Reveal>
        <Reveal i={1}>
          <Heading
            text={trackB ? 'Teams with many audiences are already ##running agents##.' : 'Where agent platforms are heading.'}
            className="mb-[min(5vh,40px)] max-w-[22ch]"
          />
        </Reveal>
        <div className="grid gap-3 md:grid-cols-3">
          {trackB
            ? PROOF_STORIES.map((p, i) => (
                <Reveal key={p.customer} i={2 + i} className="www-card www-card--neutral www-proof">
                  <p className="www-number">{p.metric}</p>
                  <p className="www-lead mt-1">{p.label}</p>
                  <p className="www-caption mt-4">
                    {p.customer} · {p.useCase}
                  </p>
                  <p className="www-small mt-2">{p.detail}</p>
                  <a href={p.href} target="_blank" rel="noopener noreferrer" className="www-link mt-auto pt-4">
                    Read the story →<span className="sr-only"> (opens in new tab)</span>
                  </a>
                </Reveal>
              ))
            : PROOF_ASSETS.map((p, i) => (
                <Reveal key={p.title} i={2 + i} className="www-card www-card--neutral www-proof">
                  <p className="www-caption">{p.kind}</p>
                  <p className="www-h3 mt-2">{p.title}</p>
                  <a href={p.href} target="_blank" rel="noopener noreferrer" className="www-link mt-auto pt-6">
                    Read →<span className="sr-only"> (opens in new tab)</span>
                  </a>
                </Reveal>
              ))}
        </div>
      </div>
    </Scene>
  )
}

/* ============================================================= FIRST 90 DAYS */

function FirstNinetyDays({ c }: { c: AgentPlatformContent }) {
  const cats = [...new Set(c.stack.value.filter((t) => !t.ours && t.category !== 'Tool').map((t) => t.category.toLowerCase()))].slice(0, 3)
  const stackPhrase = cats.length ? cats.join(cats.length > 2 ? ', ' : ' and ').replace(/, ([^,]*)$/, ' and $1') : 'the tools you already run'
  const customer = c.state.value === 'customer'
  return (
    <Scene id="migration" tone="neutral">
      <div data-xray="first-90-days">
        <Reveal i={0}>
          <Eyebrow>The path forward</Eyebrow>
        </Reveal>
        <Reveal i={1}>
          <Heading text={customer ? 'Your next 90 days' : 'Your first 90 days'} className="mb-[min(5vh,40px)]" />
        </Reveal>
        <ol className="grid gap-3 md:grid-cols-2 lg:grid-cols-4" role="list">
          {FIRST_90_DAYS.map((s, i) => (
            <Reveal key={s.step} as="li" i={2 + i} data-xray="timeline-phases" className="www-card www-card--white flex flex-col">
              <span className="www-step-n">{i + 1}</span>
              <h3 className="www-h3 mt-4">{s.step}</h3>
              <p className="www-body mt-2">{s.body.replace('{stack}', stackPhrase)}</p>
              <span className="www-role mt-auto">{s.role}</span>
            </Reveal>
          ))}
        </ol>
        <Reveal i={6} className="www-governance mt-3">
          <MaterialIcon name="verified_user" size="24" />
          <p className="www-body flex-1">{GOVERNANCE_LINE}</p>
          <a href={TRUST_CENTER} target="_blank" rel="noopener noreferrer" className="www-link">
            Trust Center →<span className="sr-only"> (opens in new tab)</span>
          </a>
        </Reveal>
      </div>
    </Scene>
  )
}

/* ====================================================================== CLOSE */

function Close({ c }: { c: AgentPlatformContent }) {
  const st = STATES[c.state.value]
  const { connect, sent } = useConnect()
  const [a, b] = c.themes.value
  const reasons = [THEMES[a].reason, THEMES[b].reason, `It runs on the stack ${c.account} already has. Nothing gets replaced.`]
  const people = c.rep.value.named
  return (
    <section id="cta" data-scene data-tone="dark" className="www-scene www-scene--dark www-scene--fill">
      <div id="form" className="www-scene__inner vb-container mx-auto w-full px-4 lg:px-8">
        <div className="grid gap-[min(5vh,48px)] lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7">
            <Reveal i={0}>
              <p className="www-eyebrow www-eyebrow--on-dark">Next steps</p>
            </Reveal>
            <Reveal i={1} data-xray="cta-title">
              <Heading text={fill(st.closeHeading, c)} className="text-white" />
            </Reveal>
            <ol className="mt-[min(4vh,32px)] flex flex-col gap-3" role="list" data-xray="cta-description">
              {reasons.map((r, i) => (
                <Reveal key={r} as="li" i={2 + i} className="www-reason">
                  <span className="www-reason__n">{i + 1}</span>
                  <span className="www-lead">{r}</span>
                </Reveal>
              ))}
            </ol>
          </div>
          <div className="flex flex-col gap-3 lg:col-span-5">
            <Reveal i={3} className="www-card www-card--dark-2">
              {people.length ? (
                <ul className="flex flex-col gap-3" role="list">
                  {people.map((p) => (
                    <li key={p.name} data-xray="team-members" className="flex items-center gap-3">
                      <span className="www-avatar">{p.initials}</span>
                      <span>
                        <span className="font-nudge block text-2xl leading-tight font-extrabold">{p.name}</span>
                        <span className="www-small block text-white/70">{p.role}</span>
                        {p.email && <span className="www-small block text-white/70">{p.email}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div data-xray="team-members" className="flex items-center gap-3">
                  <span className="www-avatar">OP</span>
                  <span>
                    <span className="font-nudge block text-2xl leading-tight font-extrabold">{c.rep.value.pod}</span>
                  </span>
                </div>
              )}
            </Reveal>
            <Reveal i={4} className="www-card www-card--dark-2">
              <p className="www-caption text-white/70">Built for</p>
              <ul className="mt-2 flex flex-col gap-1.5" role="list">
                {c.teams.value.slice(0, 3).map((t) => (
                  <li key={t} className="www-body flex items-center gap-2">
                    <span className="www-dot" aria-hidden="true" /> {t}
                  </li>
                ))}
              </ul>
              <p className="www-small mt-3 text-white/70">Reviewing with colleagues? Forward this page. It stands on its own.</p>
            </Reveal>
          </div>
        </div>
        <Reveal i={5} className="www-close-band">
          <p className="www-h2 text-white">{st.closeLine}</p>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" className="www-btn" id="cta-connect-btn" onClick={() => connect('cta-connect-btn')}>
              <MaterialIcon name="bolt" size="20" /> {sent ? "You're all set" : ctaLabel(st.primaryCta, people)}
            </Button>
            <Button asChild variant="white" className="www-btn">
              <a href={st.secondaryCta.href} target="_blank" rel="noopener noreferrer">
                {st.secondaryCta.label}
              </a>
            </Button>
          </div>
        </Reveal>
        <Colophon>
          {c.smallPrint.tagline && <span>{c.smallPrint.tagline}</span>}
          {c.smallPrint.legal && <span>{c.smallPrint.legal}</span>}
          <a href="https://www.optimizely.com/ai/" target="_blank" rel="noopener noreferrer">
            Agent Platform
          </a>
          <a href="https://www.optimizely.com/field-notes/customer-stories" target="_blank" rel="noopener noreferrer">
            Customer stories
          </a>
          <a href={TRUST_CENTER} target="_blank" rel="noopener noreferrer">
            Trust Center
          </a>
        </Colophon>
      </div>
    </section>
  )
}

function StickyAsk({ text, label }: { text: string; label: string }) {
  const { connect } = useConnect()
  return <StickyCta text={text} label={label} onAction={() => connect('sticky-connect-btn')} />
}

/* ============================================================== REVIEW LAYER */

/**
 * `?review=1`: where every part of this page came from, and the state switcher. Laura's N12: the
 * build-logic layer is for review only and is never part of the production page.
 */
function ReviewLayer({ c, search }: { c: AgentPlatformContent; search: string }) {
  const href = (state: string) => {
    const p = new URLSearchParams(search)
    p.set('state', state)
    return `?${p.toString()}`
  }
  const rows: Array<[string, { from: string; note?: string }]> = [
    ['State', c.state],
    ['Hero pills', c.pills],
    ['Stat tiles', c.stats],
    ['Stat source', c.statsSource],
    ['Teams', c.teams],
    ['Stack', c.stack],
    ['Priorities', c.priorities],
    ['Exec quote', c.quote],
    ['Question', c.question],
    ['Theme ranking', c.themes],
    ['Observed lines', c.observed],
    ['Job lines', c.jobs],
    ['Rep', c.rep],
  ]
  return (
    <aside className="www-review" aria-label="Review: where this page's content came from">
      <p className="font-semibold">Review · {STATES[c.state.value].label}</p>
      <nav className="mt-2 flex flex-wrap gap-1" aria-label="Lifecycle state">
        {STATE_IDS.map((s) => (
          <a key={s} href={href(s)} className={cn('www-review__state', s === c.state.value && 'is-on')}>
            {STATES[s].label}
          </a>
        ))}
      </nav>
      <table className="mt-3">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <th>{k}</th>
              <td>
                <span className={`www-review__from www-review__from--${v.from}`}>{v.from}</span> {v.note}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2">
        Themes:{' '}
        {c.themeEvidence
          .slice()
          .sort((x, y) => y.score - x.score)
          .map((e) => `${THEMES[e.theme].name} ${e.score}`)
          .join(' · ')}
      </p>
      <p className="mt-1">{c.notShown.length} legacy fields not shown on this template (see account-fields).</p>
    </aside>
  )
}
