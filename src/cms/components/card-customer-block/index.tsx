/**
 * Port of optimizely.com `components/block/card-customer-block/index.tsx`.
 *
 * The markup, the class list and the early return are upstream's, unchanged. Three things
 * had to move, and each is forced by this repo rather than chosen:
 *
 * 1. `href = ResourceUrl`. Upstream's `ResourceUrl` is a link object, so its renderer reads
 *    `ResourceUrl?.url?.default`. A content reference is a 400 on an `elementEnabled`
 *    content type, so the property IS the href here — see DIVERGENCE.md.
 *
 * 2. `max-w-card`, used directly. It compiles against `--max-width-card: 622px`, now vendored
 *    from upstream's `app/globals.css` (`src/vendor/opticom/app/globals.css`, imported by
 *    `src/index.css`). This card previously hard-coded `max-w-[622px]` because that token did
 *    not exist here yet — see `src/vendor/opticom/UPSTREAM.md`, "The CSS entry point".
 *
 * 3. Nothing reads `displaySettings`, because `display-settings.ts` declares a default
 *    template with `settings: []` — upstream's card has exactly one appearance and takes its
 *    colour scheme from the section around it.
 *
 * The `bg-(--color-…)` form is upstream's and is also the only form that works here:
 * `src/index.css` clears `--color-tertiary-4/5/6/7` and `--color-secondary-darkfir` from the
 * Tailwind theme (they are re-declared in `styles/greenfield.css` at the app's own hex), so
 * `bg-tertiary-4` compiles to nothing while `bg-(--color-tertiary-4)` resolves. Measured on
 * both theme configurations, not assumed.
 */
import { CardBottomBar, CardResourceDetails } from '@/components/_ui/card'
import type { CardCustomerBlockProps } from './types'

export default function CardCustomerBlock({
  Headline,
  Body,
  ImageUrl,
  ImageAlt,
  ResourceType,
  Duration,
  CompanyName,
  CompanyLogoUrl,
  ResourceUrl,
}: CardCustomerBlockProps) {
  const href = ResourceUrl

  if (!href) return null

  return (
    <a
      href={href}
      className="group block max-w-card rounded-[26px] bg-(--color-tertiary-5) p-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-secondary-darkfir)"
    >
      <div className="overflow-clip rounded-[25px] bg-(--color-tertiary-4) px-1.5 pt-1.5 transition-all duration-200 ease-out group-hover:-translate-y-1 group-hover:translate-x-1 group-active:translate-x-0 group-active:translate-y-0 group-active:bg-(--color-tertiary-5)">
        <div className="flex flex-col rounded-[20px] bg-white">
          {ImageUrl && (
            <div className="px-4 pt-4">
              <img
                src={ImageUrl}
                alt={ImageAlt ?? ''}
                className="h-[158px] w-full rounded-[12px] object-cover"
              />
            </div>
          )}
          <div className="flex flex-col gap-8 px-6 pt-8 pb-6">
            <div className="flex flex-col gap-5 text-(--color-secondary-darkfir)">
              {Headline && (
                <h3 className="font-headline text-headline-xs leading-[1.04] font-(--font-weight-headline-extrabold)">
                  {Headline}
                </h3>
              )}
              {Body && (
                <p className="font-body text-body-s line-clamp-3 leading-[1.4]">{Body}</p>
              )}
            </div>
            <CardResourceDetails
              resourceType={ResourceType}
              duration={Duration}
              colorScheme="dark"
            />
          </div>
        </div>
        <CardBottomBar
          companyName={CompanyName}
          companyLogoUrl={CompanyLogoUrl}
          colorScheme="dark"
        />
      </div>
    </a>
  )
}
