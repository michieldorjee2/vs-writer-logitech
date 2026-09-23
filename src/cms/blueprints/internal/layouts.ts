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

/** A standard band. `bg` is one of prod's section colours. */
export function sheet(bg: 'white' | 'neutral' | 'transparent' | 'dark_forest' | 'mid_neutral'): Settings {
  return {
    backgroundColor: bg,
    containerWidth: 'contained',
    paddingTop: 'px_80',
    paddingTopLg: 'xxl',
    paddingBottom: 'px_108',
    paddingX: 'px_8',
    roundedCorners: 'top',
  }
}

/** The hero: a contained neutral CARD with all four corners rounded, like the reference's. */
export const HERO_CARD: Settings = {
  backgroundColor: 'neutral',
  containerWidth: 'contained_bg',
  paddingTop: 'px_80',
  paddingTopLg: 'xxl',
  paddingBottom: 'extra_loose',
  paddingX: 'px_28',
  paddingXLg: 'loose',
  roundedCorners: 'all',
  marginTop: 'sm',
  marginTopLg: 'lg',
}

/** The closing CTA: a dark green card, as the reference's form section. */
export const CLOSE_CARD: Settings = {
  backgroundColor: 'mid_dark_green',
  containerWidth: 'contained_bg',
  paddingTop: 'px_80',
  paddingTopLg: 'xxl',
  paddingBottom: 'extra_loose',
  paddingX: 'px_28',
  paddingXLg: 'loose',
  roundedCorners: 'all',
  marginTop: 'md',
  marginBottom: 'md',
}

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
export const ROW_GRID: Settings = { displayMode: 'grid', gridColumns: 'cols_12', gap: 'sm', columnGap: 'sm' }

/** Reading width: full on phones, 10/12 on tablets, 8/12 from column 3 on desktop. */
export const COL_BODY: Settings = {
  colSpan: 'full',
  colSpanMd: 'span_10',
  colSpanLg: 'span_8',
  colStartMd: 'start_2',
  colStartLg: 'start_3',
  gap: 'md',
}

/** Hero copy: left-aligned, 7/12 on desktop. */
export const COL_HERO: Settings = { colSpan: 'full', colSpanMd: 'span_10', colSpanLg: 'span_7', gap: 'md' }

/** Full width, for chrome. */
export const COL_FULL: Settings = { colSpan: 'full' }

/**
 * N-up cards. The row becomes an N-column grid and each item's column just takes one track,
 * so the slot's reading-width column settings have to be reset, not merely left alone.
 */
export function cards(lg: 'cols_2' | 'cols_3' | 'cols_4', md: 'cols_1' | 'cols_2' = 'cols_2') {
  return {
    row: { displayMode: 'grid', gridColumns: 'cols_1', gridColumnsMd: md, gridColumnsLg: lg, gap: 'sm', columnGap: 'sm' },
    column: {
      colSpan: 'auto',
      colSpanMd: 'inherit',
      colSpanLg: 'inherit',
      colStartMd: 'inherit',
      colStartLg: 'inherit',
    },
  }
}
