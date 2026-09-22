/**
 * AbmStakeholderElement — a customer-side person on the buying committee.
 *
 * No upstream renderer to port: optimizely.com has no customer-side person card (see
 * DIVERGENCE.md). What IS taken from upstream is the *treatment* of `card-author-block`'s
 * `CardAuthorCard`, the only other person card in the catalogue — the same `colorScheme`
 * dark/light branching, the same token vocabulary, the same `focus-visible` ring on
 * `--color-secondary-ltblue`, and its `getInitials()` verbatim. So a stakeholder card and an
 * author card read as the same family.
 *
 * ALIGNING WITH SIBLINGS WITHOUT KNOWING THEM. This is one element in one column; the three
 * stakeholders beside it are three independent renders that never meet. Everything that has
 * to line up across them therefore lines up because the template is FIXED, not because the
 * cards agreed:
 *
 *   - `grid-cols-[theme(spacing.12)_minmax(0,1fr)]` — the avatar column is exactly 3rem wide
 *     (theme step 12 at this app's rescaled root — see tailwind.config.js's rem-scale-mismatch
 *     comment) on every card, so every name starts at the same x.
 *   - `grid-rows-[theme(spacing.12)_1fr]` — the header band is exactly 3rem tall on every
 *     card, so the engagement badge below it starts at the same y whether or not a person has
 *     a Role. `truncate` on the name and the role is the price of that: a two-line name would
 *     overflow a fixed row, so long text ellipses and the full string stays in `title`.
 *   - `h-full` + `mt-auto` on the footer — the column stretches to the row's height (both
 *     Row display modes stretch their items), so the footer sits on the card's own bottom
 *     edge, which is the row's bottom edge, which is the same line on every sibling.
 *
 * `EngagementNote` is the badge's `title` and nothing else, which is what `content-type.ts`
 * specifies ("shown as the badge tooltip") and what the legacy `ABMHyperPage` card did. It
 * is also the safer default: the note is the account team's private read on a person, and
 * `showEngagementTier` exists precisely so both it and the badge disappear on an
 * outward-facing page — so both are gated on the same flag.
 */
import { cva } from 'class-variance-authority'
import { Avatar, AvatarFallback } from '@/components/_ui/avatar'
import { Icons } from '@/components/_ui/icons'
import { parseDisplaySettings } from '@/lib/hooks/parseDisplaySettings'
import { EditableField } from '@/lib/optimizely/features/draft'
import type { DisplaySettings } from '@/lib/optimizely/types/display-settings'
import { cn } from '@/lib/utils'
import type {
  AbmStakeholderElementProps,
  AbmStakeholderEngagementTier,
} from './types'

/**
 * `./types` declares `displaySettings?: Record<string, string>`, which is the WRITE shape.
 * Graph delivers — and `visual-builder.tsx` passes — an ARRAY of `{key, value}`; see
 * RENDERER-SPEC.md. Corrected here rather than in `types.ts`, which is outside this task's
 * scope; the divergence is reported back rather than fixed in place.
 */
type Props = Omit<AbmStakeholderElementProps, 'displaySettings'> & {
  displaySettings?: DisplaySettings
  isFirst?: boolean
  locale?: string
}

type DisplaySettingValues = {
  colorScheme?: 'dark' | 'light'
  /** `extractDefaults()` stringifies a boolean default, so this arrives as `'true'`. */
  showEngagementTier?: boolean | string
}

type Tier = AbmStakeholderEngagementTier

/**
 * The engagement ramp, as one CSS variable per tier. Setting `--tier` on the card rather
 * than on the badge lets the avatar ring and the badge read the same value without either
 * one restating the ramp, and keeps the scheme variants down to two entries instead of the
 * eight a tier x scheme compound would need.
 *
 * Ordinal, not categorical: sage -> ltblue -> grass -> lime is a progression, which is what
 * cold -> champion is. Champion lands on the brand lime on purpose — it is the end of the
 * ramp and the one state worth looking for.
 */
const cardVariants = cva(
  'grid h-full grid-cols-[theme(spacing.12)_minmax(0,1fr)] grid-rows-[theme(spacing.12)_1fr] gap-x-4 gap-y-4 rounded-[12px] p-5',
  {
    variants: {
      tier: {
        cold: '[--tier:var(--color-tertiary-6)]',
        warm: '[--tier:var(--color-secondary-ltblue)]',
        engaged: '[--tier:var(--color-primary-grass)]',
        champion: '[--tier:var(--color-primary-lfgreen)]',
      } satisfies Record<Tier, string>,
      colorScheme: {
        dark: 'bg-(--color-tertiary-midfir) text-(--color-tertiary-4)',
        light: 'bg-(--color-tertiary-2) text-(--color-tertiary-midfir)',
      } satisfies Record<NonNullable<DisplaySettingValues['colorScheme']>, string>,
    },
    defaultVariants: { tier: 'cold', colorScheme: 'dark' },
  }
)

const badgeVariants = cva(
  'font-overline text-body-3xs inline-flex w-fit items-center rounded-[8px] px-2.5 py-1 leading-[1.2] tracking-[0.42px] uppercase',
  {
    variants: {
      colorScheme: {
        dark: 'border border-(--tier) text-(--tier)',
        light: 'bg-(--tier) text-(--color-secondary-darkfir)',
      } satisfies Record<NonNullable<DisplaySettingValues['colorScheme']>, string>,
      /** The end of the ramp is filled in both schemes — a champion should not read as an outline. */
      emphasis: { true: '', false: '' },
    },
    compoundVariants: [
      {
        colorScheme: 'dark',
        emphasis: true,
        class: 'border-(--tier) bg-(--tier) text-(--color-secondary-darkfir)',
      },
    ],
    defaultVariants: { colorScheme: 'dark', emphasis: false },
  }
)

const TIER_LABEL = {
  cold: 'Cold',
  warm: 'Warm',
  engaged: 'Engaged',
  champion: 'Champion',
} satisfies Record<Tier, string>

const TIERS: Tier[] = ['cold', 'warm', 'engaged', 'champion']

/**
 * `AvatarColor` is authored content — "a brand palette token or a CSS colour". A token is
 * mapped to its `var()` so the avatar follows a brand change; anything else is accepted only
 * if it looks like a colour, because it lands in a `style` attribute.
 */
const AVATAR_TOKENS: Record<string, string> = {
  lime: 'var(--color-primary-lfgreen)',
  lfgreen: 'var(--color-primary-lfgreen)',
  grass: 'var(--color-primary-grass)',
  goodtogo: 'var(--color-primary-goodtogo)',
  ltblue: 'var(--color-secondary-ltblue)',
  lightfir: 'var(--color-fir-lightfir)',
  midfir: 'var(--color-tertiary-midfir)',
  darkfir: 'var(--color-secondary-darkfir)',
  cream: 'var(--color-tertiary-2)',
  sage: 'var(--color-tertiary-6)',
}

const SAFE_CSS_COLOR =
  /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%/]+\)|hsla?\([\d\s.,%/a-z]+\)|[a-z]{3,20})$/i

function avatarBackground(raw?: string): string | undefined {
  const value = raw?.trim()
  if (!value) return undefined
  const token = AVATAR_TOKENS[value.toLowerCase()]
  if (token) return token
  return SAFE_CSS_COLOR.test(value) ? value : undefined
}

/** Upstream `card-author-card.tsx`, verbatim. */
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function isOn(value: boolean | string | undefined): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.toLowerCase() !== 'false' && value !== ''
  return false
}

/**
 * A CMS `url` property is declared as a bare `string` in `./types`, but Graph has returned
 * url properties as `{ default }` everywhere else in this repo (`src/lib/graph-types.ts`).
 * No Visual Builder Graph query exists yet to settle it, so accept both shapes.
 */
function urlValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined
  if (value && typeof value === 'object' && 'default' in value) {
    const inner = (value as { default?: unknown }).default
    if (typeof inner === 'string' && inner.trim()) return inner.trim()
  }
  return undefined
}

/**
 * `PersonSlug` is a slug, not a path: the person page is `/{companySlug}/{PersonSlug}`, and
 * an element in a column has no `companySlug` prop and no business fetching one. The account
 * page IS the first path segment, so the prefix is read off the location. Without a location
 * there is no way to build a correct href, and a wrong one is worse than none, so the link
 * is dropped. (The registry discovers renderers through `import.meta.glob`, which the SSR
 * bundler does not transform, so no renderer reaches a server render today and this cannot
 * produce a hydration mismatch.)
 */
function personHref(slug?: string): string | undefined {
  const clean = slug?.trim().replace(/^\/+|\/+$/g, '')
  if (!clean) return undefined
  if (typeof window === 'undefined') return undefined
  const company = window.location.pathname.split('/').filter(Boolean)[0]
  return company ? `/${company}/${clean}` : undefined
}

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-secondary-ltblue)'

export default function AbmStakeholderElement({
  Name,
  Role,
  Initials,
  AvatarColor,
  EngagementTier,
  EngagementNote,
  PersonSlug,
  CrmContactId,
  LinkedInUrl,
  displaySettings,
}: Props) {
  const name = Name?.trim()
  if (!name) return null

  const { colorScheme = 'dark', showEngagementTier } =
    parseDisplaySettings<DisplaySettingValues>(displaySettings)
  const scheme = colorScheme === 'light' ? 'light' : 'dark'
  const isLight = scheme === 'light'

  const tier = TIERS.includes(EngagementTier as Tier)
    ? (EngagementTier as Tier)
    : undefined
  const showTier = Boolean(tier) && isOn(showEngagementTier)

  const initials = Initials?.trim().slice(0, 4) || getInitials(name)
  const avatarBg = avatarBackground(AvatarColor)
  const role = Role?.trim()
  const note = EngagementNote?.trim()
  const linkedIn = urlValue(LinkedInUrl)
  const href = personHref(PersonSlug)

  return (
    <article
      className={cn(cardVariants({ tier, colorScheme: scheme }))}
      data-engagement={tier}
      data-crm-contact-id={CrmContactId?.trim() || undefined}
    >
      <Avatar
        size="lg"
        aria-hidden="true"
        className={cn(
          'col-start-1 row-start-1 self-center',
          showTier && 'ring-2 ring-(--tier)'
        )}
      >
        <AvatarFallback
          className={cn(
            'font-headline text-body-xs leading-none font-(--font-weight-headline-extrabold)',
            avatarBg
              ? 'bg-transparent text-(--color-secondary-darkfir)'
              : isLight
                ? 'bg-(--color-tertiary-4) text-(--color-tertiary-midfir)'
                : 'bg-(--color-secondary-darkfir) text-(--color-tertiary-4)'
          )}
          style={avatarBg ? { backgroundColor: avatarBg } : undefined}
        >
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="col-start-2 row-start-1 flex min-w-0 flex-col justify-center gap-1">
        <EditableField
          as="h3"
          field="Name"
          title={name}
          className={cn(
            'font-headline text-body-s truncate leading-[1.2] font-(--font-weight-headline-extrabold)',
            isLight ? 'text-(--color-secondary-darkfir)' : 'text-(--color-primary-1)'
          )}
        >
          {name}
        </EditableField>
        {role && (
          <EditableField
            as="p"
            field="Role"
            title={role}
            className={cn(
              'text-body-xxs truncate leading-[1.3]',
              isLight ? 'text-(--color-tertiary-midfir)' : 'text-(--color-tertiary-5)'
            )}
          >
            {role}
          </EditableField>
        )}
      </div>

      <div className="col-start-2 row-start-2 flex min-w-0 flex-col gap-3">
        {showTier && tier && (
          <span
            className={cn(
              badgeVariants({ colorScheme: scheme, emphasis: tier === 'champion' }),
              note && 'cursor-help'
            )}
            title={note || undefined}
          >
            {TIER_LABEL[tier]}
          </span>
        )}

        {(href || linkedIn) && (
          <div className="mt-auto flex items-center gap-4 pt-1">
            {href && (
              <a
                href={href}
                className={cn(
                  'text-body-xxs inline-flex items-center gap-1 leading-[1.2] underline-offset-4 hover:underline',
                  FOCUS_RING,
                  isLight
                    ? 'text-(--color-tertiary-midfir)'
                    : 'text-(--color-primary-lfgreen)'
                )}
              >
                Open their page
                <span aria-hidden="true">&rarr;</span>
              </a>
            )}
            {linkedIn && (
              <a
                href={linkedIn}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${name} on LinkedIn`}
                className={cn(
                  'inline-flex transition-opacity hover:opacity-70',
                  FOCUS_RING,
                  isLight
                    ? 'text-(--color-tertiary-midfir)'
                    : 'text-(--color-tertiary-4)'
                )}
              >
                <Icons.linkedin className="size-4" fill="currentColor" />
              </a>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
