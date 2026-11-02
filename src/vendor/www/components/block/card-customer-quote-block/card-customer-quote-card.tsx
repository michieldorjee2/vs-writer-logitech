import { CardBottomBar, CardResourceDetails } from '../../_ui/card'
import { cn, decodeText, truncateWithoutSplittingWords } from '../../../lib/utils'

const QUOTE_MAX_LENGTH = 150

function stripWrappingParagraph(html: string): string {
  return html
    .trim()
    .replace(/^<p[^>]*>/i, '')
    .replace(/<\/p>\s*$/i, '')
    .trim()
}

export interface CardCustomerQuoteCardProps {
  quoteHtml?: string | null
  attribution?: string | null
  resourceType?: string | null
  duration?: string | null
  companyName?: string | null
  companyLogoUrl?: string | null
  href?: string | null
  fullHeight?: boolean
}

export function CardCustomerQuoteCard({
  quoteHtml,
  attribution,
  resourceType,
  duration,
  companyName,
  companyLogoUrl,
  href,
  fullHeight = true,
}: CardCustomerQuoteCardProps) {
  if (!href) {
    return null
  }

  const stripped = stripWrappingParagraph(quoteHtml ?? '')
  const clamped = truncateWithoutSplittingWords(stripped, QUOTE_MAX_LENGTH)
  const quotedHtml = clamped ? `“${clamped}”` : ''

  return (
    <a
      href={href}
      className={cn(
        'group max-w-card bg-fir-800 block rounded-[26px] p-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
        fullHeight && 'h-full'
      )}
    >
      <div
        className={cn(
          'group-active:bg-fir-800 overflow-clip rounded-[25px] bg-(--color-secondary-darkfir) px-1 pt-1 transition-all duration-200 ease-out group-hover:translate-x-1 group-hover:-translate-y-1 group-active:translate-x-0 group-active:translate-y-0',
          fullHeight && 'flex h-full flex-col'
        )}
      >
        <div
          className={cn(
            'flex flex-col gap-8 rounded-[20px] bg-(--color-fir-lightfir) mask-[radial-gradient(white,black)] p-6',
            fullHeight && 'flex-1'
          )}
        >
          <div className="flex flex-col gap-5">
            {quotedHtml && (
              <blockquote
                className="font-headline text-headline-xs md:text-headline-s leading-[1.04] font-(--font-weight-headline-extrabold) text-(--color-primary-1) [&_p]:m-0 [&_p]:inline"
                dangerouslySetInnerHTML={{ __html: quotedHtml }}
              />
            )}
            {attribution && (
              <p className="font-body text-body-s leading-[1.4] font-(--font-weight-body-normal) text-(--color-tertiary-2)">
                {decodeText(attribution)}
              </p>
            )}
          </div>
          <CardResourceDetails
            resourceType={resourceType}
            duration={duration}
            colorScheme="light"
          />
        </div>
        <CardBottomBar
          companyName={companyName}
          companyLogoUrl={companyLogoUrl}
          colorScheme="light"
          logoStyle="mono"
        />
      </div>
    </a>
  )
}
