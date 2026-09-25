/**
 * Section, Row and Column at optimizely.com's CURRENT layout vocabulary.
 *
 * The class maps come from ./maps.ts, which is generated from the live site's compiled bundles —
 * read its header. The composition logic below mirrors those bundles' render functions: prod's
 * BlankSection (colour, padding/margin per breakpoint, top-rounded by default, contained width),
 * prod's Row (grid vs flex, gap fallback, flex basis from --cl-gap) and prod's Column (responsive
 * span/start/end, background, radius, padding, hide-on-device).
 *
 * Deliberately NOT ported, because no Showcase page uses them yet: section background media,
 * fades and secondary backgrounds; the row's `layout` presets and `timeline` mode; centerLastRow.
 */
import { useRef, type CSSProperties, type ReactNode } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { draftClass } from '@/lib/utils/draft-helpers'
import { useHeroScroll } from './hero-scroll'
import { PROD_LAYOUT as M, PROD_ROW_GAPS as G } from './maps'

type Settings = Record<string, string>
type DisplaySettingsInput = { key: string; value: string | boolean }[] | Settings | undefined

/** Graph delivers displaySettings as [{key, value}]; the repo defaults layer can hand an object. */
export function toSettings(ds: DisplaySettingsInput): Settings {
  if (!ds) return {}
  if (Array.isArray(ds)) return Object.fromEntries(ds.map((s) => [s.key, String(s.value)]))
  return ds
}

const truthy = (v?: string) => v === 'true' || v === 'True'
const set = (v?: string) => (v && v !== 'inherit' ? v : undefined)
/** Look up a value in a variant map without tripping TypeScript's literal-key index types. */
const at = (map: object, key?: string): string => (key ? ((map as Record<string, string>)[key] ?? '') : '')

/** Prod's `darkSectionBackgroundColors`: bands that need light ink. See ../rendering/band.ts. */
export const DARK_BACKGROUNDS = new Set<string>(M.darkSectionBackgrounds)

// ---------------------------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------------------------

const sectionVariants = cva(M.section.base, {
  variants: M.section.variants,
  defaultVariants: M.section.defaultVariants,
})

const JUSTIFY: Record<string, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
}

const CONTENT_WIDTH: Record<string, string> = {
  cols_5: 'min-[1024px]:max-w-[41.67%]',
  cols_6: 'min-[1024px]:max-w-[50%]',
  cols_7: 'min-[1024px]:max-w-[58.33%]',
  cols_8: 'min-[1024px]:max-w-[66.67%]',
  cols_9: 'min-[1024px]:max-w-[75%]',
  cols_10: 'min-[1024px]:max-w-[83.33%]',
  cols_11: 'min-[1024px]:max-w-[91.67%]',
}

function hideClasses(s: Settings): string[] {
  const out: string[] = []
  if (truthy(s.hideMobile)) out.push('max-md:hidden')
  if (truthy(s.hideTablet)) out.push('md:max-[1023.98px]:hidden')
  if (truthy(s.hideDesktop)) out.push('min-[1024px]:hidden')
  return out
}

export function ProdSection({
  displaySettings,
  children,
  className,
}: {
  displaySettings?: DisplaySettingsInput
  children?: ReactNode
  className?: string
  /** Accepted for parity with the other levels; the section itself has no draft-only classes. */
  preview?: boolean
}) {
  const s = toSettings(displaySettings)
  const ref = useRef<HTMLDivElement>(null)
  // A hero that is not a card is FULL-BLEED: fixed backdrop + scroll waypoints (./hero-scroll).
  const fullHero = s.treatment === 'hero' && (s.containerWidth || 'full') !== 'contained_bg'
  useHeroScroll(ref, fullHero)
  if (!children) return null
  const bg = s.backgroundColor || 'transparent'
  const width = s.containerWidth || 'full'
  // Prod defaults: rounded TOP corners, `default` radius, `lg` on desktop — why bands stack as sheets.
  const corners = s.roundedCorners || 'top'
  const radiusLg = s.borderRadiusLg || 'lg'
  const bp = (key: keyof typeof M.sectionBreakpoints) => at(M.sectionBreakpoints[key], set(s[key]))

  // Showcase extension (not in prod): a section-level visual treatment, rendered as a
  // `data-treatment` hook plus a class that index.css styles. `hero` = the animated gradient
  // hero with floating cards; `panel` = a soft gradient panel that white cards sit on.
  const treatment = s.treatment && s.treatment !== 'none' ? s.treatment : undefined

  const section = (
    <div
      ref={ref}
      data-treatment={treatment}
      className={cn(
        treatment && `vb-${treatment}`,
        fullHero && 'vb-hero--full',
        sectionVariants({
          backgroundColor: bg as never,
          paddingTop: (s.paddingTop || undefined) as never,
          paddingBottom: (s.paddingBottom || undefined) as never,
          paddingX: (s.paddingX || undefined) as never,
          marginTop: (s.marginTop || undefined) as never,
          marginBottom: (s.marginBottom || undefined) as never,
          contentAlign: (s.contentAlign || undefined) as never,
        }),
        DARK_BACKGROUNDS.has(bg) && 'text-white',
        ...hideClasses(s),
        at(at(M.sectionRounded.L, corners) as never, s.borderRadius || 'default'),
        radiusLg !== 'inherit' ? at(at(M.sectionRounded.M, corners) as never, radiusLg) : '',
        bp('paddingTopMd'),
        bp('paddingTopLg'),
        bp('paddingBottomMd'),
        bp('paddingBottomLg'),
        bp('marginBottomMd'),
        bp('marginBottomLg'),
        bp('marginTopMd'),
        bp('marginTopLg'),
        bp('paddingXMd'),
        bp('paddingXLg'),
        s.contentWidth && s.contentWidth !== 'full' ? CONTENT_WIDTH[s.contentWidth] : '',
        className,
      )}
    >
      {fullHero && <div className="vb-hero__backdrop" aria-hidden="true" />}
      {width === 'contained' ? (
        <div className={cn('vb-container mx-auto flex grow flex-col', JUSTIFY[s.contentAlign || 'start'])}>
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  )

  return width === 'contained_bg' ? (
    <div className="px-2 min-[1024px]:px-8">
      <div className="vb-container mx-auto">{section}</div>
    </div>
  ) : (
    section
  )
}

// ---------------------------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------------------------

const rowVariants = cva(M.row.base, {
  variants: M.row.variants,
  defaultVariants: M.row.defaultVariants,
})

/** Prod's gap rule: columnGap and rowGap each fall back to `gap`. */
function rowGapClasses(s: Settings): string[] {
  const gap = set(s.gap)
  const col = set(s.columnGap) ?? gap
  const row = set(s.rowGap) ?? gap
  return [
    at(G.colGap, col),
    at(G.colGapMd, set(s.columnGapMd)),
    at(G.colGapLg, set(s.columnGapLg)),
    at(G.rowGap, row),
    at(G.rowGapMd, set(s.rowGapMd)),
    at(G.rowGapLg, set(s.rowGapLg)),
  ]
}

export function ProdRow({
  displaySettings,
  children,
  className,
  preview,
}: {
  displaySettings?: DisplaySettingsInput
  children?: ReactNode
  className?: string
  preview?: boolean
}) {
  const s = toSettings(displaySettings)
  const mode = s.displayMode || 'flex'
  const grid = mode === 'grid'
  const flex = mode === 'flex'
  const style = {
    '--cl-gap': at(G.clGap, set(s.columnGap) ?? set(s.gap) ?? 'sm') || '16px',
  } as CSSProperties

  return (
    <div
      className={cn(
        rowVariants({
          displayMode: mode as never,
          flexBreakpoint: (flex ? s.flexBreakpoint || 'lg' : undefined) as never,
          gridColumns: (grid ? s.gridColumns : undefined) as never,
          gridColumnsMd: (grid ? s.gridColumnsMd : undefined) as never,
          gridColumnsLg: (grid ? s.gridColumnsLg : undefined) as never,
          gridColumnsXl: (grid ? s.gridColumnsXl : undefined) as never,
          gridRows: (grid ? s.gridRows : undefined) as never,
          justifyItems: (grid ? s.justifyItems : undefined) as never,
          alignItems: s.alignItems as never,
          justifyContent: s.justifyContent as never,
          alignContent: (grid ? s.alignContent : undefined) as never,
          gridAutoFlow: (grid ? s.gridAutoFlow : undefined) as never,
          marginTop: s.marginTop as never,
          marginTopMd: s.marginTopMd as never,
          marginTopLg: s.marginTopLg as never,
          marginBottom: s.marginBottom as never,
          marginBottomMd: s.marginBottomMd as never,
          marginBottomLg: s.marginBottomLg as never,
          spacing: s.spacing as never,
          background: s.background as never,
          separators: s.separators as never,
          paddingX: s.paddingX as never,
          paddingXMd: s.paddingXMd as never,
          paddingXLg: s.paddingXLg as never,
          paddingY: s.paddingY as never,
          paddingYMd: s.paddingYMd as never,
          paddingYLg: s.paddingYLg as never,
          borderRadius: s.borderRadius as never,
          borderRadiusMd: s.borderRadiusMd as never,
          borderRadiusLg: s.borderRadiusLg as never,
        }),
        'vb-row',
        ...rowGapClasses(s),
        ...hideClasses(s),
        draftClass(preview, 'vb:row'),
        className,
      )}
      style={style}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Column
// ---------------------------------------------------------------------------------------------

const columnVariants = cva(M.column.base, {
  variants: M.column.variants,
  compoundVariants: M.column.compoundVariants as never,
  defaultVariants: M.column.defaultVariants as never,
})

const COLUMN_KEYS = Object.keys(M.column.variants).filter((k) => !k.startsWith('hide'))

export function ProdColumn({
  displaySettings,
  children,
  className,
  preview,
}: {
  displaySettings?: DisplaySettingsInput
  children?: ReactNode
  className?: string
  preview?: boolean
}) {
  const s = toSettings(displaySettings)
  const picked: Record<string, unknown> = {}
  for (const k of COLUMN_KEYS) if (s[k] !== undefined && s[k] !== '') picked[k] = s[k]
  // The hide* variants are booleans in prod's cva; Graph sends them as 'True' / 'False'.
  picked.hideMobile = truthy(s.hideMobile)
  picked.hideTablet = truthy(s.hideTablet)
  picked.hideDesktop = truthy(s.hideDesktop)

  return (
    <div className={cn(columnVariants(picked as never), draftClass(preview, 'vb:col'), className)}>
      {children}
    </div>
  )
}
