/**
 * Port of optimizely.com `components/block/card-press-block/index.tsx`.
 *
 * The markup and class list are upstream's, unchanged — including the unlinked fallback,
 * which is why the card is built once into `card` and wrapped only when there is an href.
 * Four things differ, and each is forced by this repo rather than chosen:
 *
 * 1. `href = ResourceUrl`. Upstream's `ResourceUrl` is a link object and its renderer reads
 *    `ResourceUrl?.url?.default`. A content reference is a 400 on an `elementEnabled`
 *    content type, so the property IS the href here — see DIVERGENCE.md.
 *
 * 2. `PublishDate` is a real `dateTime`, not upstream's pre-formatted display string, so it
 *    is formatted at render time through the vendored `formatDate` — see `displayDate`.
 *
 * 3. `max-w-card` -> `max-w-[622px]`. That utility comes from `--max-width-card: 622px` in
 *    upstream's `app/globals.css`, which is not part of the vendored slice; compiling this
 *    repo's theme with the class present emits no rule, so keeping it would have silently
 *    dropped the card's width cap. 622px is upstream's own value.
 *
 * 4. `if (!Headline) return null`. Upstream renders the shell regardless; a press card with
 *    no headline is an empty box, and this phase's convention is to render nothing rather
 *    than an empty shell.
 *
 * Nothing reads `displaySettings`: `display-settings.ts` declares the default template with
 * `settings: []`, because the press card has a single fixed appearance.
 */
import { MaterialIcon } from '@/components/element/icon-element'
import { formatDate } from '@/lib/utils'
import type { CardPressBlockProps } from './types'

/** The locales the vendored `formatDate` accepts. */
const LOCALES = ['en', 'de', 'sv', 'no'] as const
type SupportedLocale = (typeof LOCALES)[number]

function supportedLocale(locale?: string): SupportedLocale {
  const short = locale?.slice(0, 2).toLowerCase() ?? ''
  return (LOCALES as readonly string[]).includes(short) ? (short as SupportedLocale) : 'en'
}

/**
 * An ISO-8601 instant in, a display string out.
 *
 * `timeZone: 'UTC'` is the load-bearing option, not decoration. A CMS `dateTime` picker
 * stores midnight UTC for a date the editor chose as a calendar day, and formatting that in
 * the VIEWER's zone prints the day before to every reader west of Greenwich — measured:
 * '2026-01-19T00:00:00Z' renders as 18 Jan in New York. A publish date is a calendar day,
 * so it is formatted in one fixed zone and every reader sees the day the editor picked.
 *
 * An unparseable value is printed verbatim rather than dropped, which keeps an
 * upstream-shaped legacy value ('19th Jan 2026') readable — upstream prints every value it
 * is given, because upstream's property IS the display string.
 */
function displayDate(value: string, locale?: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return formatDate(parsed, supportedLocale(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export default function CardPressBlock({
  Headline,
  Body,
  PublishDate,
  CompanyName,
  CompanyLogoUrl,
  ResourceUrl,
  locale,
}: CardPressBlockProps & { locale?: string }) {
  if (!Headline) return null

  const href = ResourceUrl

  const card = (
    <div className="group block max-w-[622px] rounded-[26px] bg-(--color-secondary-darkfir) p-px">
      <div className="overflow-clip rounded-[25px] border border-(--color-secondary-darkfir) bg-(--color-tertiary-lightfir) px-1.5 pt-1.5 transition-all duration-200 ease-out group-hover:-translate-y-1 group-hover:translate-x-1 group-active:translate-x-0 group-active:translate-y-0 group-active:bg-(--color-secondary-darkfir)">
        <div className="flex flex-col gap-8 rounded-[20px] bg-(--color-tertiary-midfir) p-6">
          <div className="flex flex-col gap-5 pr-8 text-(--color-primary-1)">
            <h3 className="font-headline text-headline-xs leading-8 font-(--font-weight-headline-extrabold)">
              {Headline}
            </h3>
            {Body && <p className="font-body text-body-s/tight">{Body}</p>}
          </div>
          {PublishDate && (
            <p className="font-body text-[16px] leading-[1.4] font-(--font-weight-body-medium) text-(--color-primary-3)">
              {displayDate(PublishDate, locale)}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between px-2 py-4 text-(--color-primary-1)">
          <div className="flex items-center gap-3 pr-6">
            {CompanyLogoUrl && (
              <div className="flex size-12 shrink-0 items-center justify-center rounded-[12px] p-1">
                <img
                  src={CompanyLogoUrl}
                  alt={CompanyName || 'Company logo'}
                  className="size-6 object-contain"
                />
              </div>
            )}
            {CompanyName && (
              <span className="font-body text-body-s/tight">{CompanyName}</span>
            )}
          </div>
          <MaterialIcon name="arrow_forward" size="40" color="var(--color-primary-1)" />
        </div>
      </div>
    </div>
  )

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-primary-1)"
      >
        {card}
      </a>
    )
  }

  return card
}
