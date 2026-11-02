import { Button } from '../../_ui/button'
import { readFragment } from '../../../lib/optimizely/graphql'
import { CalloutCtaBlockFragment, type CalloutCtaBlockProps } from './types'

export { CalloutCtaBlockFragment, type CalloutCtaBlockProps }

const colorSchemes: Record<
  string,
  { bg: string; text: string; buttonVariant: 'dark' | 'primary' }
> = {
  pink: {
    bg: 'bg-(--color-tertiary-ltpink)',
    text: 'text-(--color-secondary-darkfir)',
    buttonVariant: 'dark',
  },
  blue: {
    bg: 'bg-(--color-secondary-ltblue)',
    text: 'text-(--color-secondary-darkfir)',
    buttonVariant: 'dark',
  },
  neutral: {
    bg: 'bg-(--color-primary-3)',
    text: 'text-(--color-secondary-darkfir)',
    buttonVariant: 'dark',
  },
  darkfir: {
    bg: 'bg-(--color-tertiary-midfir)',
    text: 'text-(--color-primary-1)',
    buttonVariant: 'primary',
  },
  green: {
    bg: 'bg-(--color-primary-lfgreen)',
    text: 'text-(--color-secondary-darkfir)',
    buttonVariant: 'dark',
  },
}

export default function CalloutCtaBlock(props: CalloutCtaBlockProps) {
  const {
    Heading,
    CalloutCtaDescription: Description,
    Link,
  } = readFragment(CalloutCtaBlockFragment, props)
  const { displaySettings } = props

  const { colorScheme } = displaySettings ?? {}
  const href = Link?.url?.default
  if (!href) return null

  const scheme = colorSchemes[colorScheme ?? 'pink'] ?? colorSchemes.pink

  return (
    <div className="@container w-full">
      <a
        href={href}
        title={Link.title ?? ''}
        target={Link.target ?? ''}
        className={`${scheme.bg} group flex min-h-[200px] flex-col items-start justify-between gap-6 rounded-(--radius-module-sm) p-5 @[400px]:min-h-80 @[400px]:p-8 @[900px]:min-h-0 @[900px]:flex-row @[900px]:items-end @[900px]:gap-40 @[900px]:rounded-(--radius-module-med) @[900px]:px-10 @[900px]:py-20`}
      >
        <div className="flex min-w-0 flex-col gap-4 @[900px]:flex-1">
          <h2
            className={`font-headline text-headline-xs leading-[1.04] font-(--font-weight-headline-extrabold) ${scheme.text} @[400px]:text-headline-xl @[900px]:text-headline-3xl @[900px]:leading-[1.1]`}
            data-epi-edit="Heading"
          >
            {Heading}
          </h2>
          {Description?.html && (
            <div
              className={`prose font-body text-body-s max-w-none ${scheme.text} @[400px]:text-body-base @[900px]:text-body-lg`}
              data-epi-edit="Description"
              dangerouslySetInnerHTML={{ __html: Description.html }}
            />
          )}
        </div>
        <div className="shrink-0">
          <Button
            variant={scheme.buttonVariant}
            size="sm"
            className="@[400px]:text-body-med @[400px]:h-14 @[400px]:rounded-[20px] @[400px]:px-6 @[400px]:tracking-[0.4px]"
          >
            {Link.text ?? 'Learn more'}
          </Button>
        </div>
      </a>
    </div>
  )
}
