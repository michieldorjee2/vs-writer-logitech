/**
 * The email-only sign-up form an offer page's close band shows in place of its button, when
 * the offer chose it in Limitless (src/lib/offer-signup.ts). One field, the band's own button,
 * a line on privacy. It posts to /api/offer-signup, which reads the account from the page
 * itself and keeps the sign-up in Limitless.
 *
 * Server-rendered as part of the page, so the first render is the same everywhere: nothing
 * here reads `window` until a submit (postSignup reads the page's path and its utm_* values then).
 * Colours follow the band, as the closing CTA's text does (`[[data-band=dark]_&]`): the field
 * is light on any band, the small print takes the band's quiet ink.
 */
import { useId, useState, type FormEvent } from 'react'

import { Button } from '@/components/_ui/button'
import { StrokeButtonWrapper } from '@/components/_ui/button/stroke-wrapper'
import { cn } from '@/lib/utils'

import { postSignup, PRIVACY_URL, SIGNUP_ANCHOR, SIGNUP_WORDS, workEmailOf } from '../../lib/offer-signup'

type Variant = 'primary' | 'dark' | 'white' | 'neutral' | 'whiteStroke' | 'opalStroke' | 'darkStroke'

export interface OfferSignupFormProps {
  offerId: string
  /** The close band's own button text; "Sign up" without one. */
  buttonText?: string
  variant?: Variant
  size?: 'sm' | 'default'
  /** The band's stroke ring, when its button variant carries one (abm-closing-cta-element's table). */
  stroke?: { color?: string; video?: boolean }
}

type Status = 'idle' | 'sending' | 'invalid' | 'error' | 'done'

export default function OfferSignupForm({ offerId, buttonText, variant = 'primary', size = 'default', stroke }: OfferSignupFormProps) {
  const [status, setStatus] = useState<Status>('idle')
  const inputId = useId()
  const messageId = useId()
  const w = SIGNUP_WORDS

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status === 'sending') return
    const data = new FormData(event.currentTarget)
    const email = workEmailOf(data.get('email'))
    if (!email) {
      setStatus('invalid')
      return
    }
    setStatus('sending')
    setStatus(await postSignup(offerId, email, String(data.get('website') ?? ''), window.location))
  }

  const message = status === 'invalid' ? w.invalid : status === 'error' ? w.error : ''
  const submitButton = (
    <Button type="submit" variant={variant} size={size} disabled={status === 'sending'} className="w-full shrink-0 sm:w-auto">
      {status === 'sending' ? w.sending : buttonText || w.fallbackButton}
    </Button>
  )

  return (
    <div id={SIGNUP_ANCHOR} data-offer-signup="" className="w-full max-w-[480px] scroll-mt-24">
      {status === 'done' ? (
        <p
          role="status"
          aria-live="polite"
          className="font-body text-body-base leading-[1.45] text-(--color-secondary-darkfir) [[data-band=dark]_&]:text-(--color-primary-1)"
        >
          {w.done}
        </p>
      ) : (
        // method="post": a submit before the page hydrates must not put the email in the address bar.
        <form method="post" noValidate onSubmit={(event) => void submit(event)} className="flex w-full flex-col gap-3">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-stretch">
            <label htmlFor={inputId} className="sr-only">
              {w.label}
            </label>
            <input
              id={inputId}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              required
              placeholder={w.label}
              aria-invalid={status === 'invalid' || undefined}
              aria-describedby={messageId}
              onChange={() => status === 'invalid' && setStatus('idle')}
              className={cn(
                'h-10 w-full min-w-0 flex-1 rounded-(--radius-cta-sml) border-2 border-transparent bg-(--color-primary-1) px-4',
                'font-body text-(length:--text-body-xs) text-(--color-secondary-darkfir) placeholder:text-(--color-tertiary-7)',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-secondary-ltblue)',
                'aria-[invalid=true]:border-(--color-error-darkred)',
                size === 'default' && 'min-[1024px]:h-14 min-[1024px]:rounded-[20px] min-[1024px]:text-body-med'
              )}
            />
            {/* Off-screen and out of the tab order: a person never fills it, a bot does. */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-px w-px opacity-0" />
            {stroke ? (
              <StrokeButtonWrapper size={size} borderColor={stroke.color} video={stroke.video}>
                {submitButton}
              </StrokeButtonWrapper>
            ) : (
              submitButton
            )}
          </div>
          <p
            id={messageId}
            aria-live="polite"
            className={cn('min-h-[1.2em] font-body text-(length:--text-body-xs) leading-[1.3]', message ? 'text-(--color-error-darkred) [[data-band=dark]_&]:text-(--color-primary-1)' : '')}
          >
            {message}
          </p>
          <p className="font-body text-(length:--text-body-xs) leading-[1.4] text-(--color-tertiary-midfir) [[data-band=dark]_&]:text-(--color-tertiary-2)">
            {w.privacy}{' '}
            <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {w.privacyLink}
            </a>
          </p>
        </form>
      )}
    </div>
  )
}
