/**
 * Layout presets for the blueprints, taken from optimizely.com's own AI Marketing Certificate
 * page (www.optimizely.com/ai-marketing-certificate, CMS content 7879) — read off its live
 * composition on 2026-09-23. Every value is in PROD's display-template vocabulary
 * (src/cms/layout-prod), not the older zip's.
 *
 * What the reference does, and so what these encode:
 *  - Every band is a `contained` sheet with ROUNDED TOP corners and the same rhythm:
 *    80px top (128px desktop), 108px bottom. They stack like cards.
 *  - Colour is restrained: bands alternate white and neutral (cream); ONE dark_forest band on
 *    the page (the journey/timeline); a dark green CARD, not band, for the closing form.
 *  - Copy never runs full width: every row is a 12-column grid and text sits at 8/12 from
 *    column 3 (full width on phones, 10/12 on tablets).
 *  - Repeated items are one COLUMN each in their row, and the row's grid lays them out N-up.
 */

type Settings = Record<string, string>

/**
 * REVISED 2026-09-25 after Michiel's review: the alternating white/cream bands read as a zebra
 * — a stack of sections rather than one page. So a band is now TRANSPARENT on the page's single
 * white background, separated by even spacing alone, and colour appears only as deliberate
 * CARDS: the hero, one dark card, a soft panel behind the quotes, and the closing CTA.
 */

/** Section rhythm: 64px above on phones, 96px on desktop (row marginTop adds 32px of that). */
const BAND_SPACING: Settings = {
  paddingTop: 'default',
  paddingTopLg: 'loose',
  paddingBottom: 'none',
  paddingX: 'px_8',
  roundedCorners: 'none',
}

/** A standard band — transparent, contained, even spacing. `bg` kept for the rare exception. */
export function sheet(bg: 'transparent' | 'white' | 'neutral' = 'transparent'): Settings {
  return { backgroundColor: bg, containerWidth: 'contained', ...BAND_SPACING }
}

/** Shared by every coloured card: contained, rounded all round, generous inner padding. */
function card(bg: string, extra: Settings = {}): Settings {
  return {
    backgroundColor: bg,
    containerWidth: 'contained_bg',
    paddingTop: 'loose',
    paddingTopLg: 'extra_loose',
    paddingBottom: 'extra_loose',
    paddingBottomLg: 'xxl',
    paddingX: 'px_28',
    paddingXLg: 'loose',
    roundedCorners: 'all',
    borderRadius: 'default',
    borderRadiusLg: 'lg',
    marginTop: 'lg',
    marginTopLg: 'm_2xl',
    ...extra,
  }
}

/**
 * The hero: an animated dark gradient card with floating stat cards (index.css `.vb-hero`).
 * `dark_forest` underneath keeps the dark-band ink logic (data-band) right for everything in it.
 */
export const HERO_CARD: Settings = card('dark_forest', { treatment: 'hero', marginTop: 'sm', marginTopLg: 'md' })

/**
 * The FULL-BLEED hero (2026-09-25): edge to edge, no card. Its animated backdrop is fixed to the
 * viewport and fades out as the page scrolls over it (index.css `.vb-hero--full`, driven by
 * `useHeroScroll` in src/cms/layout-prod), dissolving into the white page instead of ending at
 * a hard card edge.
 */
export const HERO_FULL: Settings = {
  backgroundColor: 'dark_forest',
  containerWidth: 'contained',
  treatment: 'hero',
  // compact enough that the whole hero fits in 80svh on a 900px-tall screen
  paddingTop: 'px_80',
  paddingTopLg: 'px_80',
  paddingBottom: 'loose',
  paddingBottomLg: 'loose',
  paddingX: 'px_8',
  roundedCorners: 'none',
}

/** The one dark block on the page — a card, not a band. */
export const DARK_CARD: Settings = card('dark_forest')

/** A soft gradient panel that white cards sit on (index.css `.vb-panel`). */
export const PANEL_CARD: Settings = card('neutral', { treatment: 'panel' })

/** The closing CTA: a dark green card. */
export const CLOSE_CARD: Settings = card('mid_dark_green', { marginBottom: 'lg', marginBottomLg: 'm_2xl' })

/** Chrome that floats over the page rather than occupying a band. */
export const CHROME: Settings = {
  backgroundColor: 'transparent',
  containerWidth: 'full',
  paddingTop: 'none',
  paddingBottom: 'none',
  paddingX: 'none',
  roundedCorners: 'none',
}

/** Every row: prod's 12-column grid. */
export const ROW_GRID: Settings = {
  displayMode: 'grid',
  gridColumns: 'cols_12',
  gap: 'sm',
  columnGap: 'sm',
  // prod's row default `spacing` is py-8 on EVERY row; stacked rows then double up. Rows are
  // spaced by one top margin instead, so a section's rhythm is set in exactly one place.
  spacing: 'none',
  marginTop: 'mt_32',
}

/** Hero rows sit 16px apart, not the page's 32px — the hero is one composed unit. */
export const ROW_HERO: Settings = { ...ROW_GRID, marginTop: 'mt_16' }

/**
 * Copy columns span the full container, so headings, copy, tables and card rows all share ONE
 * left edge (the first version indented copy to column 3 while card rows ran full width, and the
 * edges wobbled). Readability comes from a measure in index.css instead: paragraphs ~68ch,
 * section headings balanced at ~24ch.
 */
export const COL_BODY: Settings = { colSpan: 'full', gap: 'md' }

/** Hero copy: centred, 10/12 on desktop (the headline is the widest thing on the page). */
export const COL_HERO: Settings = {
  colSpan: 'full',
  colSpanLg: 'span_10',
  colStartLg: 'start_2',
  contentAlign: 'center',
  gap: 'md',
}

/** Full width, for chrome. */
export const COL_FULL: Settings = { colSpan: 'full' }

/**
 * N-up cards. The row becomes an N-column grid and each item's column just takes one track,
 * so the slot's reading-width column settings have to be reset, not merely left alone.
 */
export function cards(lg: 'cols_2' | 'cols_3' | 'cols_4', md: 'cols_1' | 'cols_2' = 'cols_2') {
  return {
    row: { displayMode: 'grid', gridColumns: 'cols_1', gridColumnsMd: md, gridColumnsLg: lg, gap: 'sm', columnGap: 'sm', spacing: 'none', marginTop: 'mt_32' },
    column: {
      colSpan: 'auto',
      colSpanMd: 'inherit',
      colSpanLg: 'inherit',
      colStartMd: 'inherit',
      colStartLg: 'inherit',
    },
  }
}
