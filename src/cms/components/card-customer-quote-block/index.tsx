/**
 * CardCustomerQuoteBlock — a port of optimizely.com's
 * `components/block/card-customer-quote-block/index.tsx`.
 *
 * The card is upstream's, unchanged in structure: the 1px darker edge behind a `rounded-[25px]`
 * body, the lift on hover and the press back down on active, the `--color-fir-lightfir` quote
 * panel, and the two vendored sub-components (`CardResourceDetails`, `CardBottomBar`) at
 * `colorScheme="light"`, which is hard-coded upstream because this template ships no display
 * settings at all. Nothing is invented here; `display-settings.ts` has an empty `settings`
 * array and this renderer reads no setting.
 *
 * TWO ADAPTATIONS, both recorded rather than silent:
 *
 * 1. THE URL PROPERTIES. DIVERGENCE.md flags that upstream authors these two differently —
 *    `ResourceUrl` link-shaped (`ResourceUrl?.url?.default`), `CompanyLogoUrl` a bare string —
 *    while this model declares both as CMS `url`. A `url` property comes back from Graph as an
 *    object with a `default` (see the `analystCTALink { default }` / `Url { default }`
 *    selections in this repo's own `vite.config.ts` query), so neither upstream read is right
 *    for both. `resolveUrl` below accepts all three shapes and is the only place that knows.
 *
 * 2. `max-w-card`. Upstream declares `--max-width-card: 622px` in its own `app/globals.css`
 *    `@theme`; this app's `src/index.css` does not, so the utility compiles to nothing here
 *    (measured against the repo's real Tailwind pipeline). The literal keeps upstream's
 *    measured width until the token exists.
 */
import { CardBottomBar, CardResourceDetails } from '@/components/_ui/card'
import type { CardCustomerQuoteBlockProps } from './types'

/**
 * A CMS `url` property as Graph hands it back (`{ default }`), upstream's link object
 * (`{ url: { default } }`), or a bare string. Empty strings collapse to undefined so an
 * authored-but-blank field behaves like a missing one.
 */
function resolveUrl(value: unknown): string | undefined {
  if (!value) return undefined
  if (typeof value === 'string') return value || undefined
  if (typeof value !== 'object') return undefined

  const candidate = value as { default?: unknown; url?: { default?: unknown } }
  if (typeof candidate.default === 'string') return candidate.default || undefined
  if (typeof candidate.url?.default === 'string') return candidate.url.default || undefined
  return undefined
}

export default function CardCustomerQuoteBlock({
  QuoteText,
  Attribution,
  ResourceType,
  Duration,
  CompanyName,
  CompanyLogoUrl,
  ResourceUrl,
}: CardCustomerQuoteBlockProps) {
  const href = resolveUrl(ResourceUrl)

  // Upstream's guard: the whole card IS the link, so without one there is nothing to render.
  if (!href) return null

  const companyLogoUrl = resolveUrl(CompanyLogoUrl)

  return (
    <a
      href={href}
      // bg-[#061c14] is upstream's literal. It is one step darker than
      // --color-secondary-darkfir (the card body) and exists to draw the 1px edge around it;
      // no token carries that shade, and substituting the nearest one would erase the edge.
      className="group max-w-[622px] block rounded-[26px] bg-[#061c14] p-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      <div className="overflow-clip rounded-[25px] bg-(--color-secondary-darkfir) px-1.5 pt-1.5 transition-all duration-200 ease-out group-hover:translate-x-1 group-hover:-translate-y-1 group-active:translate-x-0 group-active:translate-y-0 group-active:bg-[#061c14]">
        <div className="flex flex-col gap-8 rounded-[20px] bg-(--color-fir-lightfir) p-6">
          <div className="flex flex-col gap-5">
            {QuoteText && (
              <blockquote
                data-epi-edit="QuoteText"
                className="font-body text-(length:--text-body-xxl) leading-[1.1] font-(--font-weight-body-medium) text-white"
              >
                &ldquo;{QuoteText}&rdquo;
              </blockquote>
            )}
            {Attribution && (
              <p
                data-epi-edit="Attribution"
                className="font-body text-body-s leading-[1.4] text-(--color-tertiary-2)"
              >
                {Attribution}
              </p>
            )}
          </div>
          <CardResourceDetails
            resourceType={ResourceType}
            duration={Duration}
            colorScheme="light"
          />
        </div>
        <CardBottomBar
          companyName={CompanyName}
          companyLogoUrl={companyLogoUrl}
          colorScheme="light"
        />
      </div>
    </a>
  )
}
