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
 * 2. `max-w-card`, used directly. It compiles against `--max-width-card: 622px`, now vendored
 *    from upstream's `app/globals.css` (`src/vendor/opticom/app/globals.css`, imported by
 *    `src/index.css`). This card previously hard-coded `max-w-[622px]` because that token did
 *    not exist here yet — see `src/vendor/opticom/UPSTREAM.md`, "The CSS entry point".
 */
import { CardBottomBar, CardResourceDetails } from '@/components/_ui/card'
import { parseDisplaySettings } from '@/lib/hooks/parseDisplaySettings'
import type { DisplaySettings } from '@/lib/optimizely/types/display-settings'
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
  displaySettings,
}: CardCustomerQuoteBlockProps) {
  const href = resolveUrl(ResourceUrl)
  const { cardStyle } = parseDisplaySettings<{ cardStyle?: 'dark' | 'light' }>(
    displaySettings as unknown as DisplaySettings
  )
  const light = cardStyle === 'light'

  // Upstream's guard: the whole card IS the link, so without one there is nothing to render.
  if (!href) return null

  const companyLogoUrl = resolveUrl(CompanyLogoUrl)

  if (light) {
    // The panel card: white, dark ink, the same nudge-up-and-right hover as the site's buttons.
    return (
      <a
        href={href}
        className="group block h-full rounded-[24px] bg-white p-6 shadow-[0_1px_2px_rgba(8,37,26,0.06),0_12px_32px_-12px_rgba(8,37,26,0.18)] transition-transform duration-200 ease-out hover:translate-x-0.5 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-secondary-darkfir) md:p-8"
      >
        <div className="flex h-full flex-col gap-8">
          {QuoteText && (
            <blockquote
              data-epi-edit="QuoteText"
              className="font-body text-(length:--text-body-xl) leading-[1.25] font-(--font-weight-body-medium) text-(--color-secondary-darkfir)"
            >
              &ldquo;{QuoteText}&rdquo;
            </blockquote>
          )}
          <div className="mt-auto flex flex-col gap-4">
            {Attribution && (
              <p data-epi-edit="Attribution" className="font-body text-body-s leading-[1.4] text-(--color-tertiary-midfir)">
                {Attribution}
              </p>
            )}
            <CardResourceDetails resourceType={ResourceType} duration={Duration} colorScheme="dark" />
            <CardBottomBar companyName={CompanyName} companyLogoUrl={companyLogoUrl} colorScheme="dark" />
          </div>
        </div>
      </a>
    )
  }

  return (
    <a
      href={href}
      // bg-[#061c14] is upstream's literal. It is one step darker than
      // --color-secondary-darkfir (the card body) and exists to draw the 1px edge around it;
      // no token carries that shade, and substituting the nearest one would erase the edge.
      className="group max-w-card block rounded-[26px] bg-[#061c14] p-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
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
