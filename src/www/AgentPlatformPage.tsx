/**
 * The agent platform account page (Laura Perez Riau's template, from Dan Tranter's pitch,
 * 27 October 2026): Optimizely as the layer on top of the stack the account already runs, not a
 * replacement for it. Eight sections, in her order:
 *
 *   1 hero              who we are → what agents do for them → their situation as the reason
 *   2 who we are        the same on every page, except those in WITHOUT_WHO_WE_ARE (Google)
 *   3 where it fits     their numbers, then teams / agent platform / their stack
 *   4 speaks your language  one leadership question; generic AI vs the agent platform
 *   5 use cases         two priority cards and a strip of three, from the five themes
 *   6 proof             three verified results (track B) or three reads (track A)
 *   7 first 90 days     Connect · Teach · Launch · Scale, nothing replaced
 *   8 close             headline by state, three reasons, rep or team pod, one CTA
 *
 * The account research is not one "homework" section: one fact sits in each scene (Homework),
 * the stack and teams carry the same tag, and each use case says what in the account's own data
 * put it first.
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
import type { CSSProperties, ReactNode } from 'react'
import { AccountMark, Colophon, CountUp, Eyebrow, Heading, HeroFrame, Reveal, Scene, StickyCta, WwwPage } from './ui'
import { ConnectProvider, useConnect } from './ConnectModal'
import { SCENE } from './account-helpers'
import { FIRST_90_DAYS, PLATFORM_LAYER, PROOF_ASSETS, PROOF_STORIES, STATES, THEMES, TRUST_CENTER, WHO_WE_ARE, showsWhoWeAre } from './agent-platform/library'
import { fromLegacyPage, STATE_IDS, type AgentPlatformContent } from './agent-platform/content'
import { resolveCopy, stackPhrase } from './agent-platform/copy'
import { setShownCopy, useLivePage } from './live-edit'
import { useEffect } from 'react'
import type { LifecycleState } from './agent-platform/library'

export default function AgentPlatformPage({ page, search = '' }: { page: CompetitorComparisonPage; search?: string }) {
  useOdpTracking('abm')
  const params = new URLSearchParams(search)
  // Edit mode's live edits (booth only) re-render the page from Mark's streamed values.
  const live = useLivePage(page)
  const c = fromLegacyPage(live, { state: params.get('state') as LifecycleState | null })
  const review = params.get('review') === '1'
  const st = STATES[c.state.value]
  const people = c.rep.value.named
  // The headlines and body text: the page's own copy where it has some (src/lib/page-copy.ts),
  // the template's everywhere else. Edit mode reads what each part shows now from setShownCopy.
  const copy = resolveCopy(c, live.pageCopy)
  useEffect(() => {
    setShownCopy(copy)
  })
  const t = (key: string) => {
    const v = copy[key]
    return typeof v === 'string' ? v : ''
  }
  return (
    <ConnectProvider page={page} people={people} scheduleUrl={c.scheduleUrl} teamLabel="your Optimizely account team">
      <WwwPage className="www-ap">
        <div id="main-content">
          <Hero c={c} t={t} />
          {showsWhoWeAre(page._metadata?.key) && <WhoWeAre t={t} />}
          <WhereItFits c={c} t={t} />
          <SpeaksYourLanguage c={c} t={t} checks={Array.isArray(copy['language.checks']) ? copy['language.checks'] : []} />
          <UseCases c={c} t={t} />
          <Proof c={c} t={t} />
          <FirstNinetyDays c={c} t={t} />
          <Close c={c} t={t} />
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

/** A part's text by its page-copy key (resolveCopy). */
type T = (key: string) => string

/* ================================================================== HOMEWORK */

/**
 * The account research, threaded through the page instead of parked in one section (Laura's and
 * Dan's feedback): one fact per scene, always set the same way and marked with the same tag, so
 * a reader sees the homework wherever they are. X-ray finds every one as `intel-stats`.
 */
function Homework({ stat, source, i = 2 }: { stat?: { value: string; label: string }; source?: { label: string; href: string } | null; i?: number }) {
  if (!stat) return null
  return (
    <Reveal i={i} fx="right" as="aside" data-xray="intel-stats" data-field="intelStats" className="www-note">
      <HomeworkTag />
      <p className="www-note__value">{/^(1[89]|20)\d{2}$/.test(stat.value) ? stat.value : <CountUp value={stat.value} />}</p>
      <p className="www-note__label">{stat.label}</p>
      {source && (
        <p className="www-caption mt-2">
          Source:{' '}
          <a href={source.href} target="_blank" rel="noopener noreferrer" className="underline">
            {source.label}
          </a>
        </p>
      )}
    </Reveal>
  )
}

function HomeworkTag({ children = 'Our homework', compact = false }: { children?: string; compact?: boolean }) {
  return (
    <span className="www-note__tag" title={compact ? children : undefined}>
      <MaterialIcon name="travel_explore" size="16" /> {compact ? <span className="sr-only">{children}</span> : children}
    </span>
  )
}

/** A scene's eyebrow and heading, with that scene's homework fact beside it on a wide screen. */
function SceneHead({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="www-head">
      <div className="www-head__main">{children}</div>
      {note}
    </div>
  )
}

/* ======================================================================= HERO */

function Hero({ c, t }: { c: AgentPlatformContent; t: T }) {
  const st = STATES[c.state.value]
  const { connect } = useConnect()
  const lead = c.themes.value[0]
  const second = c.themes.value[1]
  const tasks = [...THEMES[lead].tasks.slice(0, 2), THEMES[second].tasks[0], THEMES[lead].tasks[3]]
  const chips = c.stack.value.filter((t) => !t.ours).slice(0, 4)
  const dark = st.look === 'darkfir'
  return (
    <HeroFrame
      look={st.look}
      state={c.state.value}
      scene={SCENE}
      copy={
        <>
          {/* The page says whose it is once: their logo and one line, above the headline. */}
          <Reveal i={0} fx="scale" data-field="customerLogo">
            <AccountMark name={c.account} logo={c.logo} label={`Personalized for ${c.account}`} xray="account-logo" />
          </Reveal>
          <Reveal i={1} data-xray="hero-title" data-field="copy.hero.h1">
            {/* Laura's state headlines are sentences, not slogans: one step down from display size. */}
            <Heading text={t('hero.h1')} level="h1" size="h2" extrude />
          </Reveal>
          <Reveal i={2} as="p" data-xray="hero-subtitle" data-field="copy.hero.sub" className={cn('www-lead', dark ? 'text-white/85' : '')}>
            {t('hero.sub')}
          </Reveal>
          {c.pills.value.length > 0 && (
            <Reveal i={3} as="div" data-xray="intel-stats" data-field="intelStats" className="flex flex-wrap gap-2">
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
        </>
      }
      visual={
        <div className="www-agents" data-xray="agents-at-work">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 font-semibold">
              <MaterialIcon name="bolt" size="20" /> Agents at work
            </p>
            <span className="www-caption">Illustrative</span>
          </div>
          <ul className="mt-4 flex flex-col gap-2.5" role="list">
            {tasks.map((t, i) => (
              <li key={t} className="www-agents__task" style={{ '--t': i } as CSSProperties}>
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
            <div className="www-agents__chips mt-4 flex flex-wrap gap-1.5" data-field="techStack">
              {chips.map((t) => (
                <span key={t.label} className="www-agents__chip">
                  {t.label}
                </span>
              ))}
            </div>
          )}
        </div>
      }
    />
  )
}

/* ================================================================= WHO WE ARE */

function WhoWeAre({ t }: { t: T }) {
  return (
    <Scene id="who">
      <div data-xray="who-we-are">
        <Reveal i={0}>
          <Eyebrow>Who we are</Eyebrow>
        </Reveal>
        <Reveal i={1} data-field="copy.who.heading">
          <Heading text={t('who.heading')} className="max-w-[20ch]" />
        </Reveal>
        <div className="mt-[min(4vh,40px)] grid gap-3 md:grid-cols-3">
          {WHO_WE_ARE.tiles.map((tile, i) => (
            <Reveal
              key={tile.icon}
              i={2 + i}
              data-field={`copy.who.tile${i + 1}.title copy.who.tile${i + 1}.body`}
              className={cn('www-card', tile.lead ? 'www-card--lime' : 'www-card--neutral')}
            >
              <span className="www-icon-tile www-icon-tile--white">
                <MaterialIcon name={tile.icon} size="24" />
              </span>
              <h3 className="www-h3 mt-5">{t(`who.tile${i + 1}.title`)}</h3>
              <p className="www-body mt-2">{t(`who.tile${i + 1}.body`)}</p>
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
        <Reveal i={6} as="p" className="www-caption mt-4">
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

function WhereItFits({ c, t }: { c: AgentPlatformContent; t: T }) {
  const teamsFromPage = c.teams.from === 'derived'
  return (
    <Scene id="intel" tone="neutral">
      <div className="grid gap-[min(4vh,40px)] lg:grid-cols-12 lg:items-center lg:gap-12">
        <div className="flex flex-col gap-[min(4vh,32px)] lg:col-span-5">
          <div>
            <Reveal i={0}>
              <Eyebrow>Where it fits</Eyebrow>
            </Reveal>
            <Reveal i={1} data-xray="intel-headline" data-field="copy.fit.heading">
              <Heading text={t('fit.heading')} />
            </Reveal>
            <Reveal i={2} as="p" data-field="copy.fit.lead" className="www-lead mt-4">
              {t('fit.lead')}
            </Reveal>
          </div>
          <Homework stat={c.stats.value[0]} source={c.statsSource.value} i={3} />
        </div>
        <div className="flex flex-col gap-2 lg:col-span-7">
          <Reveal i={2} fx="drop" className="www-layer www-layer--teams" data-xray="teams" data-field="stakeholders">
            <p className="www-layer__label">{teamsFromPage ? <HomeworkTag>Your teams</HomeworkTag> : 'Your teams'}</p>
            <div className="flex flex-wrap gap-2">
              {c.teams.value.map((t) => (
                <span key={t} className="www-chip">
                  {t}
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal i={3} className="www-layer__arrow" aria-hidden="true">
            <MaterialIcon name="swap_vert" size="24" />
          </Reveal>
          <Reveal i={4} fx="scale" className="www-layer www-layer--platform">
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
          <Reveal i={5} className="www-layer__arrow" aria-hidden="true">
            <MaterialIcon name="swap_vert" size="24" />
          </Reveal>
          <Reveal i={6} className="www-layer www-layer--stack" data-xray="tech-stack" data-field="techStack">
            <p className="www-layer__label">
              <HomeworkTag>{`What ${c.account} runs today`}</HomeworkTag>
            </p>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="list">
              {c.stack.value.map((t, k) => (
                <li key={t.label} className={cn('www-tile', t.ours && 'www-tile--ours')} style={{ '--t': k } as CSSProperties}>
                  {/* A competitor tile already reads as its category ("Your CMS"). An
                      Optimizely tile says so once, in its category line. */}
                  {!t.competitor && <span className="www-caption">{t.ours ? `${t.category} · yours already` : t.category}</span>}
                  <span className="font-semibold">{t.label}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          {c.quote.value && (
            <Reveal i={7} as="figure" className="www-card www-card--white mt-3">
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

function SpeaksYourLanguage({ c, t, checks }: { c: AgentPlatformContent; t: T; checks: string[] }) {
  return (
    <Scene id="language">
      <div data-xray="speaks-language" className="mx-auto max-w-[1000px]">
        <Reveal i={0}>
          <Eyebrow>Speaks your language</Eyebrow>
        </Reveal>
        <Reveal i={1} data-field="copy.language.heading">
          <Heading text={t('language.heading')} className="max-w-[22ch]" />
        </Reveal>
        <Reveal i={2} fx="scale" data-field="copy.language.question" className="www-ask mt-[min(4vh,32px)]">
          <span className="www-ask__who" aria-hidden="true">
            <MaterialIcon name="person" size="22" />
          </span>
          <p className="www-ask__q">“{t('language.question')}”</p>
        </Reveal>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Reveal i={3} fx="left" data-field="copy.language.generic" className="www-card www-card--neutral">
            <p className="www-caption">A generic AI tool</p>
            <p className="www-lead mt-3 opacity-80">“{t('language.generic')}”</p>
          </Reveal>
          <Reveal i={4} fx="right" data-field="copy.language.checks" className="www-card www-card--dark">
            <p className="www-caption flex items-center gap-1 text-white">
              <MaterialIcon name="bolt" size="18" /> Optimizely agent platform
            </p>
            <ul className="mt-3 flex flex-col gap-2" role="list">
              {checks.map((k) => (
                <li key={k} className="www-body flex items-start gap-2">
                  <MaterialIcon name="check" size="20" color="var(--color-primary-lfgreen)" /> {k}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
        {c.priorities.value.length > 0 && (
          // What they are investing in is the language the agents start from.
          <Reveal i={5} className="www-priorities mt-3" data-xray="investments" data-field="investments">
            <HomeworkTag>{`Where ${c.account} is investing`}</HomeworkTag>
            <div className="flex flex-wrap gap-2">
              {c.priorities.value.map((p) => (
                <span key={p} className="www-chip">
                  {p}
                </span>
              ))}
            </div>
          </Reveal>
        )}
      </div>
    </Scene>
  )
}

/* ================================================================== USE CASES */

function UseCases({ c, t }: { c: AgentPlatformContent; t: T }) {
  const [a, b, ...rest] = c.themes.value
  const customer = c.state.value === 'customer'
  return (
    <Scene id="usecases" tone="neutral">
      <div data-xray="use-cases">
        <SceneHead note={<Homework stat={c.stats.value[1]} source={c.statsSource.value} />}>
          <Reveal i={0}>
            <Eyebrow>Where agents start</Eyebrow>
          </Reveal>
          <Reveal i={1} data-field="copy.usecases.heading">
            <Heading text={t('usecases.heading')} className="max-w-[24ch]" />
          </Reveal>
        </SceneHead>
        <div className="grid gap-3 md:grid-cols-2">
          {[a, b].map((id, i) => {
            const theme = THEMES[id]
            const obs = c.observed.value[id]
            const why = c.why.value[id]
            return (
              <Reveal
                key={id}
                i={3 + i}
                fx={i ? 'right' : 'left'}
                data-field={`copy.usecases.${id}.title copy.usecases.${id}.body`}
                className="www-card www-card--white www-usecase"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="www-icon-tile">
                    <MaterialIcon name={theme.icon} size="26" />
                  </span>
                  <Badge label={`Priority · ${theme.name}`} color="lfgreen" filled size="sm" />
                </div>
                <h3 className="www-h3 mt-5">{t(`usecases.${id}.title`)}</h3>
                <p className="www-body mt-2">{t(`usecases.${id}.body`)}</p>
                {obs ? (
                  <p className="www-why mt-4">
                    <HomeworkTag>Observed</HomeworkTag>
                    <span>
                      {obs.text}{' '}
                      <a href={obs.href} target="_blank" rel="noopener noreferrer" className="underline">
                        Source
                      </a>
                    </span>
                  </p>
                ) : (
                  why && (
                    <div className="www-why mt-4" data-field="techStack investments">
                      <HomeworkTag />
                      <dl>
                        {why.stack.length > 0 && (
                          <div>
                            <dt>In your stack</dt>
                            <dd>{why.stack.join(' · ')}</dd>
                          </div>
                        )}
                        {why.plans.length > 0 && (
                          <div>
                            <dt>On your agenda</dt>
                            <dd>{why.plans.join(' · ')}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  )
                )}
                <p className="www-caption mt-4">Measured on: {theme.measuredOn}</p>
                <p className="www-small mt-auto pt-4 font-medium">Enabled by {theme.enabledBy}</p>
              </Reveal>
            )
          })}
        </div>
        <Reveal i={5} className="mt-[min(3vh,24px)]">
          <p className="www-caption mb-3">{customer ? 'Next on your roadmap' : 'Also on the platform'}</p>
          <div className="grid gap-3 md:grid-cols-3">
            {rest.slice(0, 3).map((id) => (
              <div key={id} data-field={`copy.usecases.${id}.strip.title copy.usecases.${id}.strip.body`} className="www-card www-card--white flex items-start gap-3">
                <MaterialIcon name={THEMES[id].icon} size="24" />
                <div>
                  <p className="font-semibold">{t(`usecases.${id}.strip.title`)}</p>
                  <p className="www-small mt-1">{t(`usecases.${id}.strip.body`)}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
        <Reveal i={6} as="p" data-field="copy.usecases.closing" className="www-lead mt-[min(3vh,24px)] max-w-[52ch]">
          {t('usecases.closing')}
        </Reveal>
      </div>
    </Scene>
  )
}

/* ====================================================================== PROOF */

function Proof({ c, t }: { c: AgentPlatformContent; t: T }) {
  const trackB = STATES[c.state.value].proofTrack === 'B'
  return (
    <Scene id="proof">
      <div data-xray="proof-stories">
        <SceneHead note={<Homework stat={c.stats.value[2]} source={c.statsSource.value} />}>
          <Reveal i={0}>
            <Eyebrow>{trackB ? 'Proof it works' : 'Worth reading'}</Eyebrow>
          </Reveal>
          <Reveal i={1} data-field="copy.proof.heading">
            <Heading text={t('proof.heading')} className="max-w-[22ch]" />
          </Reveal>
        </SceneHead>
        <div className="grid gap-3 md:grid-cols-3">
          {trackB
            ? PROOF_STORIES.map((p, i) => (
                <Reveal key={p.customer} i={2 + i} fx="scale" className="www-card www-card--neutral www-proof">
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
                <Reveal key={p.title} i={2 + i} fx="scale" className="www-card www-card--neutral www-proof">
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

function FirstNinetyDays({ c, t }: { c: AgentPlatformContent; t: T }) {
  // The Connect step names their stack by category when the page knows it (agent-platform/copy.ts).
  const namesStack = stackPhrase(c) !== 'the tools you already run'
  return (
    <Scene id="migration" tone="neutral">
      <div data-xray="first-90-days">
        <SceneHead note={<Homework stat={c.stats.value[3]} source={c.statsSource.value} />}>
          <Reveal i={0}>
            <Eyebrow>The path forward</Eyebrow>
          </Reveal>
          <Reveal i={1} data-field="copy.ninety.heading">
            <Heading text={t('ninety.heading')} />
          </Reveal>
        </SceneHead>
        {/* The path draws itself left to right as the scene arrives: each step's number, then a
            line out of it toward the next step. */}
        <ol className="www-path grid gap-3 md:grid-cols-2 lg:grid-cols-4" role="list">
          {FIRST_90_DAYS.map((s, i) => (
            <Reveal
              key={s.step}
              as="li"
              i={2 + i}
              data-xray="timeline-phases"
              data-field={`${s.body.includes('{stack}') ? 'techStack ' : ''}copy.ninety.step${i + 1}.title copy.ninety.step${i + 1}.body`}
              className="www-card www-card--white www-path__step flex flex-col"
            >
              <span className="flex items-center gap-3">
                <span className="www-step-n">{i + 1}</span>
                <span className="www-path__rule" aria-hidden="true" />
                {/* The step that names their stack says where that came from. */}
                {namesStack && s.body.includes('{stack}') && <HomeworkTag compact />}
              </span>
              <h3 className="www-h3 mt-4">{t(`ninety.step${i + 1}.title`)}</h3>
              <p className="www-body mt-2">{t(`ninety.step${i + 1}.body`)}</p>
              <span className="www-role mt-auto">{s.role}</span>
            </Reveal>
          ))}
        </ol>
        <Reveal i={6} className="www-governance mt-3">
          <MaterialIcon name="verified_user" size="24" />
          <p className="www-body flex-1" data-field="copy.ninety.governance">
            {t('ninety.governance')}
          </p>
          <a href={TRUST_CENTER} target="_blank" rel="noopener noreferrer" className="www-link">
            Trust Center →<span className="sr-only"> (opens in new tab)</span>
          </a>
        </Reveal>
      </div>
    </Scene>
  )
}

/* ====================================================================== CLOSE */

function Close({ c, t }: { c: AgentPlatformContent; t: T }) {
  const st = STATES[c.state.value]
  const { connect, sent } = useConnect()
  const reasons = [t('close.reason1'), t('close.reason2'), t('close.reason3')]
  const people = c.rep.value.named
  return (
    <section id="cta" data-scene data-tone="dark" className="www-scene www-scene--dark www-scene--fill">
      <div id="form" className="www-scene__inner vb-container mx-auto w-full px-4 lg:px-8">
        <div className="grid gap-[min(4vh,40px)] lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7">
            <Reveal i={0}>
              <p className="www-eyebrow www-eyebrow--on-dark">Next steps</p>
            </Reveal>
            <Reveal i={1} data-xray="cta-title" data-field="copy.close.heading">
              <Heading text={t('close.heading')} className="text-white" />
            </Reveal>
            <ol className="mt-[min(4vh,32px)] flex flex-col gap-3" role="list" data-xray="cta-description">
              {reasons.map((r, i) => (
                <Reveal key={i} as="li" i={2 + i} fx="left" data-field={`copy.close.reason${i + 1}`} className="www-reason">
                  <span className="www-reason__n">{i + 1}</span>
                  <span className="www-lead">{r}</span>
                </Reveal>
              ))}
            </ol>
          </div>
          <div className="flex flex-col gap-3 lg:col-span-5">
            <Reveal i={3} fx="right" className="www-card www-card--dark-2" data-field="teamMembers">
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
            <Reveal i={4} fx="right" className="www-card www-card--dark-2" data-field="stakeholders">
              <p className="www-caption text-white/70">Built for</p>
              <ul className="mt-2 flex flex-col gap-1.5" role="list">
                {c.teams.value.slice(0, 3).map((t) => (
                  <li key={t} className="www-body flex items-center gap-2">
                    <span className="www-dot" aria-hidden="true" /> {t}
                  </li>
                ))}
              </ul>
              <p className="www-small mt-3 text-white/70">Forward this page to colleagues. It stands on its own.</p>
            </Reveal>
          </div>
        </div>
        {/* One call to action: the one-click ask. Scheduling and the contacts are in its panel. */}
        <Reveal i={5} className="www-close-band">
          <p className="www-h2 text-white" data-field="copy.close.line">
            {t('close.line')}
          </p>
          <Button variant="primary" className="www-btn" id="cta-connect-btn" onClick={() => connect('cta-connect-btn')}>
            <MaterialIcon name="bolt" size="20" /> {sent ? "You're all set" : ctaLabel(st.primaryCta, people)}
          </Button>
        </Reveal>
        <Colophon xray="small-print" field="footerTagline footerLegal">
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
    ['Why first', c.why],
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
