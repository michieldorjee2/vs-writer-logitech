/**
 * Offer page, www design: an existing offer ABMExperience (the `offer` blueprint's Visual Builder
 * pages) as a 1:1 landing page. The CMS content is read, never changed: ./offer-content.ts turns
 * the composition back into the blueprint's named content, and every element of every section
 * renders somewhere (unclaimed elements and unknown sections fall through to <Leftovers/>).
 * `npm run check:www` renders a full offer and proves it.
 *
 * Same scene system as the account page (./ui.tsx): one idea per window-height scene, dark
 * bookends (the invitation and the sign-up), white and Neutral 3 between, LFGreen for the
 * action. The one extruded moment is the run the writer marked in the hero headline.
 */
import type { CSSProperties, ReactNode } from 'react'
import { Button } from '../vendor/www/components/_ui/button'
import { Badge } from '../vendor/www/components/_ui/badge'
import { CardCustomerQuoteCard } from '../vendor/www/components/block/card-customer-quote-block/card-customer-quote-card'
import { PortraitTextQuoteCard } from '../vendor/www/components/block/portrait-text-quote-card-block/portrait-text-quote-card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../vendor/www/components/_ui/accordion'
import { MaterialIcon } from '../vendor/www/components/element/icon-element'
import { cn } from '../vendor/www/lib/utils'
import { AccountMark, Card, Colophon, Eyebrow, Heading, HeroFrame, Paragraphs, Reveal, Scene, Steps, StickyCta, WwwPage, plain } from './ui'
import { list, nodeKeyOf, readOffer, str, type ElementData, type OfferSection } from './offer-content'
import { useCmsEdit } from './cms-edit'
import GravatarAvatar from '../components/GravatarAvatar'
import OfferSignupForm from '../components/offer-signup/OfferSignupForm'
import { SCENE } from './account-helpers'

interface Experience {
  companyName?: string | null
  customerLogo?: { default?: string | null } | string | null
  brandAccentColor?: string | null
  composition?: unknown
}

export default function OfferPage({ experience }: { experience: Experience }) {
  const sections = readOffer(experience as Parameters<typeof readOffer>[0])
  const hero = sections.find((s) => s.slot === 'hero')
  const company = experience.companyName || ''
  const logo = typeof experience.customerLogo === 'string' ? experience.customerLogo : experience.customerLogo?.default ?? null
  const ctaText = str(hero?.values.offerCta, 'ButtonText') || 'Save your seat'
  const ctaHref = str(hero?.values.offerCta, 'ButtonUrl') || '#signup'

  return (
    <WwwPage className="www-offer">
      <div id="main-content">
        {sections.map((s, i) => (
          <OfferScene key={i} section={s} company={company} logo={logo} />
        ))}
      </div>
      <StickyCta
        text={plain(str(hero?.values.offerEyebrow, 'Text')) || plain(str(hero?.values.offerHeadline, 'Text'))}
        href={ctaHref}
        label={ctaText}
        endId="signup"
      />
    </WwwPage>
  )
}

function OfferScene({ section, company, logo }: { section: OfferSection; company: string; logo: string | null }) {
  const v = section.values
  // In the CMS editor's preview: the section's and each element's Visual Builder node, so the
  // editor outlines what it can open. Empty everywhere else (./cms-edit.tsx).
  const cms = useCmsEdit()
  const sec = cms.block(section.key)
  const b = (el: ElementData | ElementData[] | undefined) => cms.block(nodeKeyOf(el))
  const leftovers = section.extras.length ? <Leftovers elements={section.extras} /> : null
  switch (section.slot) {
    case 'hero':
      return <OfferHero v={v} company={company} logo={logo} leftovers={leftovers} attrs={sec} />

    case 'offer-about':
      return (
        <Scene id={section.anchor || 'about'} tone="neutral" attrs={sec}>
          <div className="grid gap-[min(4vh,40px)] lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-6">
              <Reveal i={0} {...b(v.aboutEyebrow)}>
                <Eyebrow>{plain(str(v.aboutEyebrow, 'Text'))}</Eyebrow>
              </Reveal>
              <Reveal i={1} {...b(v.aboutHeadline)}>
                <Heading text={str(v.aboutHeadline, 'Text')} />
              </Reveal>
            </div>
            <Reveal i={2} className="www-lead lg:col-span-6 lg:pt-10" {...b(v.aboutIntro)}>
              <Paragraphs text={str(v.aboutIntro, 'MainBody')} />
            </Reveal>
          </div>
          {list(v.aboutPillars).length > 0 && <Pillars items={list(v.aboutPillars)} block={b} />}
          {leftovers}
        </Scene>
      )

    case 'offer-problem': {
      const t = v.problemThesis as ElementData | undefined
      return (
        <Scene id="opportunity" attrs={sec}>
          <div className="grid gap-[min(5vh,48px)] lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-6">
              <Reveal i={0}>
                <Eyebrow>The opportunity</Eyebrow>
              </Reveal>
              {t && (
                <Reveal i={1} {...b(t)}>
                  <Heading text={str(t, 'Headline')} />
                </Reveal>
              )}
              {t && (
                <Reveal i={2} className="www-lead mt-5" {...b(t)}>
                  <Paragraphs text={str(t, 'Body')} />
                </Reveal>
              )}
              {t && str(t, 'Quote') && (
                <Reveal i={3} as="figure" className="www-card www-card--neutral mt-6" {...b(t)}>
                  <blockquote className="www-quote-text">“{str(t, 'Quote')}”</blockquote>
                  {str(t, 'Attribution') && <figcaption className="www-caption mt-4">{str(t, 'Attribution')}</figcaption>}
                </Reveal>
              )}
            </div>
            <ol className="flex flex-col gap-3 lg:col-span-6" role="list">
              {list(v.problemLanes).map((l, i) => (
                <Reveal key={i} as="li" i={3 + i} {...b(l)}>
                  <Card className="flex flex-col gap-2">
                    <p className="www-caption">{str(l, 'Lane')}</p>
                    {str(l, 'Need') && <h3 className="www-h3">{str(l, 'Need')}</h3>}
                    {str(l, 'Outcome') && <p className="www-body">{str(l, 'Outcome')}</p>}
                    {str(l, 'Solution') && (
                      <span className="mt-1 self-start">
                        <Badge label={`We'd use ${str(l, 'Solution')}`} color="darkgreen" filled={false} size="sm" />
                      </span>
                    )}
                  </Card>
                </Reveal>
              ))}
            </ol>
          </div>
          {leftovers}
        </Scene>
      )
    }

    case 'customer-stories':
      return (
        <Scene id="proof" attrs={sec}>
          <Reveal i={0} {...b(v.proofHeadline)}>
            <Heading text={str(v.proofHeadline, 'Text')} align="center" className="mx-auto mb-[min(5vh,48px)] max-w-[22ch]" />
          </Reveal>
          <div className="mx-auto grid max-w-[1000px] justify-items-center gap-3 md:grid-cols-2">
            {[v.proofQuote1, v.proofQuote2].filter(Boolean).map((q, i) => (
              <Reveal key={i} i={1 + i} className="www-quote w-full" {...b(q as ElementData)}>
                <QuoteCard q={q as ElementData} />
              </Reveal>
            ))}
          </div>
          {leftovers}
        </Scene>
      )

    case 'offer-hosts':
      return (
        <Scene id="hosts" compact attrs={sec}>
          <div className="grid gap-[min(5vh,48px)] lg:grid-cols-12 lg:items-center lg:gap-12">
            <div className="lg:col-span-5">
              <Reveal i={0}>
                <Eyebrow>Your hosts</Eyebrow>
              </Reveal>
              <Reveal i={1} {...b(v.hostsHeadline)}>
                <Heading text={str(v.hostsHeadline, 'Text')} />
              </Reveal>
              <Reveal i={2} className="www-lead mt-5" {...b(v.hostsIntro)}>
                <Paragraphs text={str(v.hostsIntro, 'MainBody')} />
              </Reveal>
            </div>
            <ul className="flex flex-col gap-3 lg:col-span-7" role="list">
              {list(v.hosts).map((h, i) => (
                <Reveal key={i} as="li" i={3 + i} {...b(h)}>
                  <Card className="flex items-center gap-5">
                    {/* Gravatar, then their Teams photo, for a host at Optimizely whose card holds an address; anyone else, and every host without one, is initials as always. */}
                    <GravatarAvatar email={str(h, 'Email')} initials={str(h, 'Initials') || initialsOf(str(h, 'Name'))} className="www-initials size-16 text-2xl" others="initials" />
                    <div className="min-w-0">
                      <p className="www-h3">{str(h, 'Name')}</p>
                      <p className="www-body mt-1">{str(h, 'Role')}</p>
                      {str(h, 'Email') && (
                        <a href={`mailto:${str(h, 'Email')}`} className="www-link mt-1 inline-block">
                          {str(h, 'Email')}
                        </a>
                      )}
                    </div>
                  </Card>
                </Reveal>
              ))}
            </ul>
          </div>
          {leftovers}
        </Scene>
      )

    case 'offer-outcomes':
      return (
        <Scene id="outcomes" attrs={sec}>
          <div className="mb-[min(5vh,48px)] max-w-[760px]">
            <Reveal i={0}>
              <Eyebrow>What you walk away with</Eyebrow>
            </Reveal>
            <Reveal i={1} {...b(v.outcomesHeadline)}>
              <Heading text={str(v.outcomesHeadline, 'Text')} />
            </Reveal>
            <Reveal i={2} className="www-lead mt-4" {...b(v.outcomesIntro)}>
              <Paragraphs text={str(v.outcomesIntro, 'MainBody')} />
            </Reveal>
          </div>
          <Pillars items={list(v.outcomes)} icon="check" block={b} />
          {leftovers}
        </Scene>
      )

    case 'offer-agenda':
      return (
        <Scene id="agenda" attrs={sec}>
          <div className="mb-[min(6vh,56px)] max-w-[760px]">
            <Reveal i={0}>
              <Eyebrow>The session</Eyebrow>
            </Reveal>
            <Reveal i={1} {...b(v.agendaHeadline)}>
              <Heading text={str(v.agendaHeadline, 'Text')} />
            </Reveal>
            <Reveal i={2} className="www-lead mt-4" {...b(v.agendaIntro)}>
              <Paragraphs text={str(v.agendaIntro, 'MainBody')} />
            </Reveal>
          </div>
          <Steps
            steps={list(v.agendaSteps).map((s, i) => ({
              label: String(i + 1).padStart(2, '0'),
              title: str(s, 'Title'),
              body: str(s, 'Description'),
              attrs: b(s),
            }))}
          />
          {leftovers}
        </Scene>
      )

    case 'offer-fit':
      return (
        <Scene id="fit" tone="neutral" attrs={sec}>
          <div className="grid gap-3 lg:grid-cols-12 lg:gap-4">
            <div className="mb-[min(3vh,24px)] lg:col-span-4 lg:mb-0 lg:pr-6">
              <Reveal i={0}>
                <Eyebrow>{company ? `For ${company}` : 'For you'}</Eyebrow>
              </Reveal>
              <Reveal i={1} {...b(v.fitHeadline)}>
                <Heading text={str(v.fitHeadline, 'Text')} />
              </Reveal>
            </div>
            {v.fitYes && <FitCard c={v.fitYes as ElementData} icon="check" i={2} attrs={b(v.fitYes)} />}
            {v.fitNo && <FitCard c={v.fitNo as ElementData} icon="arrow_forward" i={3} attrs={b(v.fitNo)} />}
          </div>
          {leftovers}
        </Scene>
      )

    case 'offer-faq': {
      const faqs = list(v.faqs)
      return (
        <Scene id="faq" attrs={sec}>
          <div className="mx-auto max-w-[880px]">
            <Reveal i={0} {...b(v.faqHeadline)}>
              <Heading text={str(v.faqHeadline, 'Text') || 'Questions'} align="center" className="mb-[min(5vh,40px)]" />
            </Reveal>
            {/* optimizely.com's accordion mounts an answer only when it opens, so the server HTML
                has none. The FAQPage data carries every answer for crawlers and no-JS readers. */}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd(faqs) }} />
            <Reveal i={1}>
              <Accordion type="multiple" className="flex flex-col gap-2">
                {faqs.map((f, i) => (
                  <AccordionItem key={i} value={`q${i}`} className="bg-primary-3" {...b(f)}>
                    <AccordionTrigger>{str(f, 'Question')}</AccordionTrigger>
                    <AccordionContent>
                      <div className="www-body px-8 pb-8">
                        <Paragraphs text={str(f, 'Answer')} />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Reveal>
          </div>
          {leftovers}
        </Scene>
      )
    }

    case 'contact-close':
      return <SignUp close={v.offerClose as ElementData | undefined} company={company} leftovers={leftovers} attrs={sec} closeAttrs={b(v.offerClose)} />

    default:
      return (
        <Scene id={section.anchor || undefined} attrs={sec}>
          <Reveal i={0}>
            <Eyebrow>{section.name}</Eyebrow>
          </Reveal>
          <Leftovers elements={section.extras} />
        </Scene>
      )
  }
}

/* ======================================================================= HERO */

function OfferHero({
  v,
  company,
  logo,
  leftovers,
  attrs,
}: {
  v: OfferSection['values']
  company: string
  logo: string | null
  leftovers: ReactNode
  /** The hero section's CMS editor hook. */
  attrs: Record<string, string>
}) {
  const cms = useCmsEdit()
  const b = (el: ElementData | ElementData[] | undefined) => cms.block(nodeKeyOf(el))
  const highlights = list(v.offerHighlights)
  const second = v.offerSecondaryCta as ElementData | undefined
  const intro = str(v.offerIntro, 'MainBody')
  return (
    <>
      <HeroFrame
        scene={SCENE}
        attrs={attrs}
        copy={
          <>
            {company && (
              <Reveal i={0} fx="scale">
                <AccountMark name={company} logo={logo} label={`Made for ${company}`} />
              </Reveal>
            )}
            {str(v.offerEyebrow, 'Text') && (
              <Reveal i={0} {...b(v.offerEyebrow)}>
                <Badge label={plain(str(v.offerEyebrow, 'Text'))} color="lfgreen" filled size="sm" iconName="event" />
              </Reveal>
            )}
            <Reveal i={1} {...b(v.offerHeadline)}>
              {/* The writer's ##run## is the page's one extruded moment. Offer headlines run from
                  about 30 to 75 characters, so the size follows the length (ui.tsx fitVars). */}
              <Heading text={str(v.offerHeadline, 'Text')} level="h1" extrude fit className="text-white" />
            </Reveal>
            <Reveal i={3} className="flex flex-wrap gap-3">
              {str(v.offerCta, 'ButtonText') && (
                <Button asChild variant="primary" className="www-btn">
                  <a href={str(v.offerCta, 'ButtonUrl') || '#signup'} {...external(str(v.offerCta, 'ButtonUrl'))} {...b(v.offerCta)}>
                    {str(v.offerCta, 'ButtonText')}
                  </a>
                </Button>
              )}
              {second && str(second, 'ButtonText') && (
                <Button asChild variant="white" className="www-btn">
                  <a href={str(second, 'ButtonUrl') || '#about'} {...external(str(second, 'ButtonUrl'))} {...b(second)}>
                    {str(second, 'ButtonText')}
                  </a>
                </Button>
              )}
            </Reveal>
          </>
        }
        visual={
          highlights.length > 0 && (
            // The offer's facts as cards on the photo. Not StatBlock: these values are phrases
            // ("For Scale AI", "A real agent"), which StatBlock would extrude like numbers.
            <ul className="www-facts" role="list">
              {highlights.map((h, i) => (
                <li key={i} className="www-fact" style={{ '--t': i } as CSSProperties} {...b(h)}>
                  <span className="font-nudge text-[clamp(20px,min(2.2vw,3.6vh),34px)] leading-[1.02] font-extrabold">{str(h, 'StatValue')}</span>
                  <span className="www-small">{str(h, 'Description') || str(h, 'StatDescription')}</span>
                </li>
              ))}
            </ul>
          )
        }
      />
      {intro && (
        <Scene id="intro" compact>
          {/* One column on the page's content width: the opening line, then the paragraphs under it. */}
          <Reveal i={0} className="www-intro" {...b(v.offerIntro)}>
            <Paragraphs text={intro} />
          </Reveal>
          {leftovers}
        </Scene>
      )}
    </>
  )
}

/* ===================================================================== PIECES */

const PILLAR_ICONS = ['verified_user', 'autorenew', 'fact_check', 'bolt', 'insights', 'groups']

/** Icon, title, text: three across. */
function Pillars({ items, icon, block }: { items: ElementData[]; icon?: string; block: (el: ElementData) => Record<string, string> }) {
  return (
    <div className={cn('mt-[min(6vh,56px)] grid gap-3', items.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2')}>
      {items.map((p, i) => (
        <Reveal key={i} i={3 + i} {...block(p)}>
          <Card tone="white" className="flex h-full flex-col gap-4">
            <span className="www-icon-tile">
              <MaterialIcon name={icon ?? PILLAR_ICONS[i % PILLAR_ICONS.length]} size="24" />
            </span>
            <h3 className="www-h3">{str(p, 'Title')}</h3>
            <p className="www-body">{str(p, 'Description')}</p>
          </Card>
        </Reveal>
      ))}
    </div>
  )
}

function FitCard({ c, icon, i, attrs }: { c: ElementData; icon: string; i: number; attrs: Record<string, string> }) {
  const lines = str(c, 'CalloutText').split('\n').map((l) => l.trim()).filter(Boolean)
  return (
    <Reveal i={i} className="lg:col-span-4" {...attrs}>
      <Card tone="white" className="flex h-full flex-col gap-5">
        <h3 className="www-h3">{str(c, 'CalloutHeading')}</h3>
        <ul className="flex flex-col gap-3" role="list">
          {lines.map((l, k) => (
            <li key={k} className="www-body flex gap-3">
              <span className="www-tick shrink-0">
                <MaterialIcon name={icon} size="20" />
              </span>
              {/* The writer's own bullet glyph (✓ / →) becomes the icon; the words are kept. */}
              <span>{l.replace(/^[✓✔→•\-–]\s*/, '')}</span>
            </li>
          ))}
        </ul>
      </Card>
    </Reveal>
  )
}

function QuoteCard({ q }: { q: ElementData }) {
  const href = str(q, 'ResourceUrl')
  if (href) {
    return (
      <CardCustomerQuoteCard
        quoteHtml={str(q, 'QuoteText')}
        attribution={str(q, 'Attribution')}
        resourceType={str(q, 'ResourceType') || 'Customer story'}
        duration={str(q, 'Duration') || null}
        companyName={str(q, 'CompanyName')}
        companyLogoUrl={str(q, 'CompanyLogoUrl') || null}
        href={href}
      />
    )
  }
  return (
    <PortraitTextQuoteCard
      Badge={str(q, 'ResourceType') || 'Customer story'}
      Quote={`“${plain(str(q, 'QuoteText'))}”`}
      AuthorName={str(q, 'Attribution')}
      AuthorTitle={str(q, 'CompanyName')}
      companyLogoUrl={str(q, 'CompanyLogoUrl') || null}
      companyName={str(q, 'CompanyName')}
      cardColor="primary_3"
    />
  )
}

/* ==================================================================== SIGN UP */

function SignUp({
  close,
  company,
  leftovers,
  attrs,
  closeAttrs,
}: {
  close?: ElementData
  company: string
  leftovers: ReactNode
  /** The CMS editor's hooks: the close section, and its one element. */
  attrs: Record<string, string>
  closeAttrs: Record<string, string>
}) {
  if (!close && !leftovers) return null
  const url = str(close, 'ScheduleUrl')
  // The offer chose the email form in Limitless (src/lib/offer-signup.ts tags the close band with
  // SignupOfferId and points the hero's main button at #signup): the form takes the button's
  // place, as on the classic page. The form carries the "signup" anchor itself then, so the band
  // takes another id (one id per page); the hero link and the sticky bar land on the form.
  const signupId = str(close, 'SignupOfferId')
  return (
    <section id={signupId ? 'signup-band' : 'signup'} data-scene data-tone="dark" data-band="dark" className="www-scene www-scene--dark www-scene--fill" {...attrs}>
      <div className="www-scene__inner vb-container mx-auto w-full px-4 lg:px-8">
        <div className="grid items-center gap-[min(6vh,56px)] lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7" {...closeAttrs}>
            <Reveal i={0}>
              <Heading text={str(close, 'Title')} size="display" className="text-white" />
            </Reveal>
            {str(close, 'Description') && (
              <Reveal i={1} as="p" className="www-lead mt-6 max-w-[50ch] text-white/85">
                {str(close, 'Description')}
              </Reveal>
            )}
            {signupId ? (
              <Reveal i={2} className="mt-10">
                <OfferSignupForm offerId={signupId} buttonText={str(close, 'ButtonText') || undefined} variant="primary" />
              </Reveal>
            ) : (
              str(close, 'ButtonText') && (
                <Reveal i={2} className="mt-10">
                  <Button asChild variant="primary" className="www-btn">
                    <a href={url || '#'} {...external(url)}>
                      {str(close, 'ButtonText')}
                    </a>
                  </Button>
                </Reveal>
              )
            )}
          </div>
          <Reveal i={3} className="www-signup-photo lg:col-span-5">
            <picture>
              <source type="image/avif" srcSet={`${SCENE}-960.avif 960w, ${SCENE}-1600.avif 1600w`} sizes="(min-width: 992px) 40vw, 100vw" />
              <img src={`${SCENE}-960.webp`} alt="" className="size-full object-cover" loading="lazy" decoding="async" />
            </picture>
          </Reveal>
        </div>
        {leftovers}
        <Colophon>
          {company && <span>Made for {company}</span>}
          <span>© {new Date().getFullYear()} Optimizely</span>
        </Colophon>
      </div>
    </section>
  )
}

/* ================================================================= LEFTOVERS */

/**
 * Any element no slot claimed, rendered by type so it is never silently lost. On today's pages
 * this renders nothing; it exists for pages written by a future blueprint revision.
 */
function Leftovers({ elements }: { elements: ElementData[] }) {
  const cms = useCmsEdit()
  if (!elements.length) return null
  return (
    <div className="mt-10 flex flex-col gap-4">
      {elements.map((el, i) => {
        switch (el.__typename) {
          case 'StackedHeadingElement':
            return (
              <div key={i} {...cms.block(nodeKeyOf(el))}>
                <Heading text={str(el, 'Text')} level="h3" />
              </div>
            )
          case 'TextContentElement':
            return (
              <div key={i} {...cms.block(nodeKeyOf(el))}>
                <Paragraphs text={str(el, 'MainBody')} className="www-body" />
              </div>
            )
          case 'ButtonBlock':
            return (
              <div key={i} {...cms.block(nodeKeyOf(el))}>
                <Button asChild variant="dark" className="www-btn">
                  <a href={str(el, 'ButtonUrl') || '#'}>{str(el, 'ButtonText')}</a>
                </Button>
              </div>
            )
          default: {
            const text = Object.entries(el)
              .filter(([k, val]) => k !== '__typename' && k !== '_metadata' && typeof val === 'string' && val)
              .map(([, val]) => val as string)
            return (
              <Card key={i} attrs={cms.block(nodeKeyOf(el))}>
                {text.map((t, j) => (
                  <p key={j} className={j === 0 ? 'www-h3' : 'www-body mt-2'}>
                    {t}
                  </p>
                ))}
              </Card>
            )
          }
        }
      })}
    </div>
  )
}

/** schema.org FAQPage for the offer's questions. `<` is escaped so an answer can never close the script. */
export function faqJsonLd(faqs: ElementData[]): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: str(f, 'Question'),
      acceptedAnswer: { '@type': 'Answer', text: str(f, 'Answer') },
    })),
  }).replace(/</g, '\\u003c')
}

function external(url: string) {
  return /^https?:\/\//.test(url) && !/^https?:\/\/showcase\.optimizely\.com/.test(url)
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {}
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
