/**
 * AbmTeamMemberElement — one person on OUR side of the account: the "who to call" strip.
 *
 * The plainer twin of `AbmStakeholderElement`. Same skeleton, same avatar primitive, same
 * `colorScheme` choice copied from upstream `card-author-block`, but no surface, no border
 * and no state badge: four scalars, an avatar and a mailto. This is a contact row, not a
 * profile, and the content type is deliberately four fields for that reason.
 *
 * ALIGNING WITH SIBLINGS WITHOUT KNOWING THEM. Each member is an independent element in its
 * own column and cannot see the others, so the alignment is baked into a fixed template
 * rather than negotiated: `grid-cols-[theme(spacing.10)_minmax(0,1fr)]` puts every name at
 * the same x (theme step 10 = 2.5rem at this app's rescaled root — see tailwind.config.js's
 * rem-scale-mismatch comment), and `grid-rows-[theme(spacing.10)_auto]` puts every email on
 * the same y whether or not the person above has a Role. `truncate` keeps a long name or
 * title inside that fixed first row; the full string stays in `title`.
 */
import { cva } from 'class-variance-authority'
import { Mail } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/_ui/avatar'
import { parseDisplaySettings } from '@/lib/hooks/parseDisplaySettings'
import { EditableField } from '@/lib/optimizely/features/draft'
import type { DisplaySettings } from '@/lib/optimizely/types/display-settings'
import { cn } from '@/lib/utils'
import type { AbmTeamMemberElementProps } from './types'

/**
 * `./types` declares `displaySettings?: Record<string, string>`, which is the WRITE shape.
 * Graph delivers — and `visual-builder.tsx` passes — an ARRAY of `{key, value}`; see
 * RENDERER-SPEC.md. Corrected here rather than in `types.ts`, which is outside this task's
 * scope; the divergence is reported back rather than fixed in place.
 */
type Props = Omit<AbmTeamMemberElementProps, 'displaySettings'> & {
  displaySettings?: DisplaySettings
  isFirst?: boolean
  locale?: string
}

type DisplaySettingValues = {
  colorScheme?: 'dark' | 'light'
}

type Scheme = NonNullable<DisplaySettingValues['colorScheme']>

const cardVariants = cva(
  'grid h-full grid-cols-[theme(spacing.10)_minmax(0,1fr)] grid-rows-[theme(spacing.10)_auto] gap-x-3 gap-y-2',
  {
    variants: {
      colorScheme: {
        dark: 'text-(--color-tertiary-5)',
        light: 'text-(--color-tertiary-midfir)',
      } satisfies Record<Scheme, string>,
    },
    defaultVariants: { colorScheme: 'dark' },
  }
)

const avatarVariants = cva('font-headline text-body-xxs leading-none font-(--font-weight-headline-extrabold)', {
  variants: {
    colorScheme: {
      dark: 'bg-(--color-tertiary-midfir) text-(--color-tertiary-4)',
      light: 'bg-(--color-tertiary-4) text-(--color-tertiary-midfir)',
    } satisfies Record<Scheme, string>,
  },
  defaultVariants: { colorScheme: 'dark' },
})

const nameVariants = cva(
  'font-headline text-body-xs truncate leading-[1.2] font-(--font-weight-headline-extrabold)',
  {
    variants: {
      colorScheme: {
        dark: 'text-(--color-primary-1)',
        light: 'text-(--color-secondary-darkfir)',
      } satisfies Record<Scheme, string>,
    },
    defaultVariants: { colorScheme: 'dark' },
  }
)

const emailVariants = cva(
  'text-body-xxs inline-flex w-fit min-w-0 items-center gap-1.5 leading-[1.2] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-secondary-ltblue)',
  {
    variants: {
      colorScheme: {
        dark: 'text-(--color-primary-lfgreen)',
        light: 'text-(--color-tertiary-midfir)',
      } satisfies Record<Scheme, string>,
    },
    defaultVariants: { colorScheme: 'dark' },
  }
)

/** Upstream `card-author-card.tsx`, verbatim. */
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/**
 * `Email` is a plain short string — the CMS has no email format, so the value is whatever an
 * editor typed. Only something that actually looks like an address becomes a `mailto:`; the
 * rest is dropped rather than rendered as a broken link.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function AbmTeamMemberElement({
  Initials,
  Name,
  Role,
  Email,
  displaySettings,
}: Props) {
  const name = Name?.trim()
  if (!name) return null

  const { colorScheme = 'dark' } =
    parseDisplaySettings<DisplaySettingValues>(displaySettings)
  const scheme: Scheme = colorScheme === 'light' ? 'light' : 'dark'

  const initials = Initials?.trim().slice(0, 4) || getInitials(name)
  const role = Role?.trim()
  const email = Email?.trim()
  const mailto = email && EMAIL.test(email) ? email : undefined

  return (
    <div className={cardVariants({ colorScheme: scheme })}>
      <Avatar aria-hidden="true" className="col-start-1 row-start-1 self-center">
        <AvatarFallback className={avatarVariants({ colorScheme: scheme })}>
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="col-start-2 row-start-1 flex min-w-0 flex-col justify-center gap-0.5">
        <EditableField
          as="p"
          field="Name"
          title={name}
          className={nameVariants({ colorScheme: scheme })}
        >
          {name}
        </EditableField>
        {role && (
          <EditableField
            as="p"
            field="Role"
            title={role}
            className={cn(
              'text-body-3xs truncate leading-[1.3]',
              scheme === 'light'
                ? 'text-(--color-tertiary-7)'
                : 'text-(--color-tertiary-6)'
            )}
          >
            {role}
          </EditableField>
        )}
      </div>

      {mailto && (
        <a
          href={`mailto:${mailto}`}
          className={cn('col-start-2 row-start-2', emailVariants({ colorScheme: scheme }))}
        >
          <Mail className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{mailto}</span>
        </a>
      )}
    </div>
  )
}
