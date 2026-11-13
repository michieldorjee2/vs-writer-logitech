/**
 * What an offer page shows once its offer has ended (../lib/offer-ended.ts): the offer page's own
 * hero, with the company's mark, a headline saying the offer is over, one line, and a way on, to
 * the company's account page when it has one, otherwise to optimizely.com. Nothing of the ended
 * offer's content is in it.
 */
import { Button } from '../vendor/www/components/_ui/button'
import { AccountMark, Heading, HeroFrame, Reveal, WwwPage } from './ui'
import { SCENE } from './account-helpers'
import { ENDED_WORDS, OPTIMIZELY_HOME, type EndedOffer } from '../lib/offer-ended'

export default function OfferEndedPage({ experience }: { experience: EndedOffer }) {
  const company = experience.companyName
  const accountUrl = company ? experience.accountUrl : null
  return (
    <WwwPage className="www-offer www-offer--ended">
      <div id="main-content">
        <HeroFrame
          scene={SCENE}
          copy={
            <>
              {company && (
                <Reveal i={0} fx="scale">
                  <AccountMark name={company} logo={experience.customerLogo?.default ?? null} label={ENDED_WORDS.madeFor(company)} />
                </Reveal>
              )}
              <Reveal i={1}>
                <Heading text={ENDED_WORDS.heading} level="h1" fit className="text-white" />
              </Reveal>
              <Reveal i={2} as="p" className="www-lead text-white/85">
                {accountUrl && company ? ENDED_WORDS.withAccount(company) : ENDED_WORDS.withoutAccount}
              </Reveal>
              <Reveal i={3} className="flex flex-wrap gap-3">
                <Button asChild variant="primary" className="www-btn">
                  {accountUrl && company ? (
                    <a href={accountUrl}>{ENDED_WORDS.toAccount(company)}</a>
                  ) : (
                    <a href={OPTIMIZELY_HOME}>{ENDED_WORDS.toOptimizely}</a>
                  )}
                </Button>
              </Reveal>
            </>
          }
        />
      </div>
    </WwwPage>
  )
}
