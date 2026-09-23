/**
 * optimizely.com's CURRENT layout vocabulary for Visual Builder sections, rows and columns,
 * lifted from the live site's compiled bundles on 2026-09-23 (www.optimizely.com/ai-marketing-certificate,
 * chunks 0712p-y4ca1ws / 2wkkdgw2ib5r0). GENERATED — do not hand-edit; see ./README.md.
 *
 * The OptimizelyHeadless zip vendored under src/vendor/opticom is OLDER than production: it has no
 * colSpanLg / colStartLg, no column background/padding/radius, one paddingY, and none of the newer
 * colours. Prod's CMS display templates and renderers both carry the fuller set, so this is the
 * source of truth until a current zip is synced.
 *
 * Two mechanical adaptations for Showcase, and only these:
 *  1. lg: -> min-[1024px]:, xl: -> min-[1280px]:. Showcase's legacy screens are bootstrap's
 *     (lg 992, xl 1200); changing them would move the 2,709 legacy pages. md (768) matches.
 *  2. rounded-sm / rounded-lg -> 16px / 40px. index.css pins --radius-sm/--radius-lg to their v3
 *     values for the legacy templates, so the token names would resolve to 2px / 8px here.
 */
export const PROD_LAYOUT = {
 "sectionBackground": {
  "transparent": "bg-transparent",
  "white": "bg-primary-1",
  "neutral": "bg-tertiary-2",
  "green": "bg-primary-lfgreen",
  "light_blue": "bg-secondary-ltblue",
  "dark_forest": "bg-secondary-darkfir text-white",
  "dark_green": "bg-secondary-darkfir text-white",
  "mid_green": "bg-(--color-green-grass)",
  "mid_dark_green": "bg-(--color-fir-midfir) text-white",
  "light_dark_green": "bg-(--color-fir-lightfir) text-white",
  "light_pink": "bg-(--color-pink-ltpink)",
  "dark_pink": "bg-(--color-tertiary-darkpink) text-white",
  "dark_blue": "bg-(--color-tertiary-darkblue) text-white",
  "mid_neutral": "bg-(--color-neutral-4)"
 },
 "darkSectionBackgrounds": [
  "dark_forest",
  "dark_green",
  "mid_dark_green",
  "light_dark_green",
  "dark_pink",
  "dark_blue"
 ],
 "section": {
  "base": "relative flex w-full flex-col",
  "variants": {
   "backgroundColor": {
    "transparent": "bg-transparent",
    "white": "bg-primary-1",
    "neutral": "bg-tertiary-2",
    "green": "bg-primary-lfgreen",
    "light_blue": "bg-secondary-ltblue",
    "dark_forest": "bg-secondary-darkfir text-white",
    "dark_green": "bg-secondary-darkfir text-white",
    "mid_green": "bg-(--color-green-grass)",
    "mid_dark_green": "bg-(--color-fir-midfir) text-white",
    "light_dark_green": "bg-(--color-fir-lightfir) text-white",
    "light_pink": "bg-(--color-pink-ltpink)",
    "dark_pink": "bg-(--color-tertiary-darkpink) text-white",
    "dark_blue": "bg-(--color-tertiary-darkblue) text-white",
    "mid_neutral": "bg-(--color-neutral-4)"
   },
   "paddingTop": {
    "none": "pt-0",
    "compact": "pt-4",
    "default": "pt-8",
    "pt_48": "pt-12",
    "loose": "pt-16",
    "px_80": "pt-20",
    "extra_loose": "pt-24",
    "p_3xl": "pt-36",
    "p_4xl": "pt-42",
    "xxl": "pt-32"
   },
   "paddingBottom": {
    "none": "pb-0",
    "compact": "pb-4",
    "default": "pb-8",
    "px_40": "pb-10",
    "pb_48": "pb-12",
    "loose": "pb-16",
    "extra_loose": "pb-24",
    "px_108": "pb-27",
    "xxl": "pb-32",
    "px_168": "pb-42"
   },
   "paddingX": {
    "none": "px-0",
    "px_8": "px-2",
    "px_16": "px-4",
    "compact": "px-4",
    "px_28": "px-7",
    "default": "px-2 min-[1024px]:px-8",
    "loose": "px-16"
   },
   "marginTop": {
    "negative_2xl": "-mt-32",
    "negative_xl": "-mt-20",
    "negative_lg": "-mt-10",
    "negative_md": "-mt-6",
    "negative_sm": "-mt-4",
    "none": "mt-0",
    "sm": "mt-4",
    "md": "mt-6",
    "lg": "mt-8",
    "xl": "mt-12",
    "m_2xl": "mt-16",
    "m_2_5xl": "mt-20",
    "m_3xl": "mt-24",
    "m_4xl": "mt-32"
   },
   "marginBottom": {
    "negative_2xl": "-mb-32",
    "negative_xl": "-mb-20",
    "negative_lg": "-mb-10",
    "negative_md": "-mb-6",
    "negative_sm": "-mb-4",
    "none": "mb-0",
    "sm": "mb-4",
    "md": "mb-6",
    "lg": "mb-8",
    "xl": "mb-12",
    "m_2xl": "mb-16",
    "m_2_5xl": "mb-20",
    "m_3xl": "mb-24",
    "m_4xl": "mb-32"
   },
   "contentAlign": {
    "start": "justify-start",
    "center": "justify-center",
    "end": "justify-end",
    "between": "justify-between"
   }
  },
  "defaultVariants": {
   "backgroundColor": "transparent",
   "paddingTop": "px_80",
   "paddingBottom": "px_108",
   "paddingX": "default",
   "marginTop": "none",
   "marginBottom": "none",
   "contentAlign": "start"
  }
 },
 "sectionBreakpoints": {
  "paddingTopMd": {
   "none": "md:pt-0",
   "compact": "md:pt-4",
   "default": "md:pt-8",
   "pt_48": "md:pt-12",
   "loose": "md:pt-16",
   "px_80": "md:pt-20",
   "extra_loose": "md:pt-24",
   "p_3xl": "md:pt-36",
   "p_4xl": "md:pt-42",
   "xxl": "md:pt-32"
  },
  "paddingTopLg": {
   "none": "min-[1024px]:pt-0",
   "compact": "min-[1024px]:pt-4",
   "default": "min-[1024px]:pt-8",
   "pt_48": "min-[1024px]:pt-12",
   "loose": "min-[1024px]:pt-16",
   "px_80": "min-[1024px]:pt-20",
   "extra_loose": "min-[1024px]:pt-24",
   "p_3xl": "min-[1024px]:pt-36",
   "p_4xl": "min-[1024px]:pt-42",
   "xxl": "min-[1024px]:pt-32"
  },
  "paddingBottomMd": {
   "none": "md:pb-0",
   "compact": "md:pb-4",
   "default": "md:pb-8",
   "px_40": "md:pb-10",
   "pb_48": "md:pb-12",
   "loose": "md:pb-16",
   "extra_loose": "md:pb-24",
   "px_108": "md:pb-27",
   "xxl": "md:pb-32",
   "px_168": "md:pb-42"
  },
  "paddingBottomLg": {
   "none": "min-[1024px]:pb-0",
   "compact": "min-[1024px]:pb-4",
   "default": "min-[1024px]:pb-8",
   "px_40": "min-[1024px]:pb-10",
   "pb_48": "min-[1024px]:pb-12",
   "loose": "min-[1024px]:pb-16",
   "extra_loose": "min-[1024px]:pb-24",
   "px_108": "min-[1024px]:pb-27",
   "xxl": "min-[1024px]:pb-32",
   "px_168": "min-[1024px]:pb-42"
  },
  "marginBottomMd": {
   "negative_2xl": "md:-mb-32",
   "negative_xl": "md:-mb-20",
   "negative_lg": "md:-mb-10",
   "negative_md": "md:-mb-6",
   "negative_sm": "md:-mb-4",
   "none": "md:mb-0",
   "sm": "md:mb-4",
   "md": "md:mb-6",
   "lg": "md:mb-8",
   "xl": "md:mb-12",
   "m_2xl": "md:mb-16",
   "m_2_5xl": "md:mb-20",
   "m_3xl": "md:mb-24",
   "m_4xl": "md:mb-32"
  },
  "marginBottomLg": {
   "negative_2xl": "min-[1024px]:-mb-32",
   "negative_xl": "min-[1024px]:-mb-20",
   "negative_lg": "min-[1024px]:-mb-10",
   "negative_md": "min-[1024px]:-mb-6",
   "negative_sm": "min-[1024px]:-mb-4",
   "none": "min-[1024px]:mb-0",
   "sm": "min-[1024px]:mb-4",
   "md": "min-[1024px]:mb-6",
   "lg": "min-[1024px]:mb-8",
   "xl": "min-[1024px]:mb-12",
   "m_2xl": "min-[1024px]:mb-16",
   "m_2_5xl": "min-[1024px]:mb-20",
   "m_3xl": "min-[1024px]:mb-24",
   "m_4xl": "min-[1024px]:mb-32"
  },
  "marginTopMd": {
   "negative_2xl": "md:-mt-32",
   "negative_xl": "md:-mt-20",
   "negative_lg": "md:-mt-10",
   "negative_md": "md:-mt-6",
   "negative_sm": "md:-mt-4",
   "none": "md:mt-0",
   "sm": "md:mt-4",
   "md": "md:mt-6",
   "lg": "md:mt-8",
   "xl": "md:mt-12",
   "m_2xl": "md:mt-16",
   "m_2_5xl": "md:mt-20",
   "m_3xl": "md:mt-24",
   "m_4xl": "md:mt-32"
  },
  "marginTopLg": {
   "negative_2xl": "min-[1024px]:-mt-32",
   "negative_xl": "min-[1024px]:-mt-20",
   "negative_lg": "min-[1024px]:-mt-10",
   "negative_md": "min-[1024px]:-mt-6",
   "negative_sm": "min-[1024px]:-mt-4",
   "none": "min-[1024px]:mt-0",
   "sm": "min-[1024px]:mt-4",
   "md": "min-[1024px]:mt-6",
   "lg": "min-[1024px]:mt-8",
   "xl": "min-[1024px]:mt-12",
   "m_2xl": "min-[1024px]:mt-16",
   "m_2_5xl": "min-[1024px]:mt-20",
   "m_3xl": "min-[1024px]:mt-24",
   "m_4xl": "min-[1024px]:mt-32"
  },
  "paddingXMd": {
   "none": "md:px-0",
   "compact": "md:px-4",
   "default": "md:px-8",
   "loose": "md:px-16"
  },
  "paddingXLg": {
   "none": "min-[1024px]:px-0",
   "compact": "min-[1024px]:px-4",
   "default": "min-[1024px]:px-8",
   "loose": "min-[1024px]:px-16"
  }
 },
 "sectionRounded": {
  "L": {
   "none": {
    "none": "",
    "xs": "",
    "sm": "",
    "default": "",
    "lg": ""
   },
   "all": {
    "none": "rounded-none",
    "xs": "rounded-xs",
    "sm": "rounded-[16px]",
    "default": "rounded-default",
    "lg": "rounded-[40px]"
   },
   "top": {
    "none": "rounded-t-none",
    "xs": "rounded-t-xs",
    "sm": "rounded-t-[16px]",
    "default": "rounded-t-default",
    "lg": "rounded-t-[40px]"
   },
   "bottom": {
    "none": "rounded-b-none",
    "xs": "rounded-b-xs",
    "sm": "rounded-b-[16px]",
    "default": "rounded-b-default",
    "lg": "rounded-b-[40px]"
   }
  },
  "M": {
   "none": {
    "none": "",
    "xs": "",
    "sm": "",
    "default": "",
    "lg": ""
   },
   "all": {
    "none": "min-[1024px]:rounded-none",
    "xs": "min-[1024px]:rounded-xs",
    "sm": "min-[1024px]:rounded-[16px]",
    "default": "min-[1024px]:rounded-default",
    "lg": "min-[1024px]:rounded-[40px]"
   },
   "top": {
    "none": "min-[1024px]:rounded-t-none",
    "xs": "min-[1024px]:rounded-t-xs",
    "sm": "min-[1024px]:rounded-t-[16px]",
    "default": "min-[1024px]:rounded-t-default",
    "lg": "min-[1024px]:rounded-t-[40px]"
   },
   "bottom": {
    "none": "min-[1024px]:rounded-b-none",
    "xs": "min-[1024px]:rounded-b-xs",
    "sm": "min-[1024px]:rounded-b-[16px]",
    "default": "min-[1024px]:rounded-b-default",
    "lg": "min-[1024px]:rounded-b-[40px]"
   }
  }
 },
 "row": {
  "base": "",
  "variants": {
   "displayMode": {
    "grid": "grid",
    "flex": "flex flex-1 flex-col flex-nowrap"
   },
   "flexBreakpoint": {
    "none": "flex-row",
    "sm": "sm:flex-row",
    "md": "md:flex-row",
    "lg": "min-[1024px]:flex-row",
    "xl": "min-[1280px]:flex-row"
   },
   "gridColumns": {
    "auto": "grid-cols-auto",
    "none": "",
    "cols_1": "grid-cols-1",
    "cols_2": "grid-cols-2",
    "cols_3": "grid-cols-3",
    "cols_4": "grid-cols-4",
    "cols_5": "grid-cols-5",
    "cols_6": "grid-cols-6",
    "cols_7": "grid-cols-7",
    "cols_8": "grid-cols-8",
    "cols_9": "grid-cols-9",
    "cols_10": "grid-cols-10",
    "cols_11": "grid-cols-11",
    "cols_12": "grid-cols-12"
   },
   "gridColumnsMd": {
    "inherit": "",
    "auto": "md:grid-cols-auto",
    "none": "md:grid-cols-none",
    "cols_1": "md:grid-cols-1",
    "cols_2": "md:grid-cols-2",
    "cols_3": "md:grid-cols-3",
    "cols_4": "md:grid-cols-4",
    "cols_5": "md:grid-cols-5",
    "cols_6": "md:grid-cols-6",
    "cols_7": "md:grid-cols-7",
    "cols_8": "md:grid-cols-8",
    "cols_9": "md:grid-cols-9",
    "cols_10": "md:grid-cols-10",
    "cols_11": "md:grid-cols-11",
    "cols_12": "md:grid-cols-12"
   },
   "gridColumnsLg": {
    "inherit": "",
    "auto": "min-[1024px]:grid-cols-auto",
    "none": "min-[1024px]:grid-cols-none",
    "cols_1": "min-[1024px]:grid-cols-1",
    "cols_2": "min-[1024px]:grid-cols-2",
    "cols_3": "min-[1024px]:grid-cols-3",
    "cols_4": "min-[1024px]:grid-cols-4",
    "cols_5": "min-[1024px]:grid-cols-5",
    "cols_6": "min-[1024px]:grid-cols-6",
    "cols_7": "min-[1024px]:grid-cols-7",
    "cols_8": "min-[1024px]:grid-cols-8",
    "cols_9": "min-[1024px]:grid-cols-9",
    "cols_10": "min-[1024px]:grid-cols-10",
    "cols_11": "min-[1024px]:grid-cols-11",
    "cols_12": "min-[1024px]:grid-cols-12"
   },
   "gridColumnsXl": {
    "inherit": "",
    "auto": "min-[1280px]:grid-cols-auto",
    "none": "min-[1280px]:grid-cols-none",
    "cols_1": "min-[1280px]:grid-cols-1",
    "cols_2": "min-[1280px]:grid-cols-2",
    "cols_3": "min-[1280px]:grid-cols-3",
    "cols_4": "min-[1280px]:grid-cols-4",
    "cols_5": "min-[1280px]:grid-cols-5",
    "cols_6": "min-[1280px]:grid-cols-6",
    "cols_7": "min-[1280px]:grid-cols-7",
    "cols_8": "min-[1280px]:grid-cols-8",
    "cols_9": "min-[1280px]:grid-cols-9",
    "cols_10": "min-[1280px]:grid-cols-10",
    "cols_11": "min-[1280px]:grid-cols-11",
    "cols_12": "min-[1280px]:grid-cols-12"
   },
   "gridRows": {
    "auto": "",
    "none": "grid-rows-none",
    "rows_1": "grid-rows-1",
    "rows_2": "grid-rows-2",
    "rows_3": "grid-rows-3",
    "rows_4": "grid-rows-4",
    "rows_5": "grid-rows-5",
    "rows_6": "grid-rows-6"
   },
   "justifyItems": {
    "default": "",
    "start": "justify-items-start",
    "center": "justify-items-center",
    "end": "justify-items-end"
   },
   "alignItems": {
    "default": "",
    "start": "items-start",
    "center": "items-center",
    "end": "items-end",
    "baseline": "items-baseline"
   },
   "justifyContent": {
    "default": "",
    "center": "justify-center",
    "end": "justify-end",
    "between": "justify-between",
    "around": "justify-around",
    "evenly": "justify-evenly"
   },
   "alignContent": {
    "default": "",
    "center": "content-center",
    "end": "content-end",
    "between": "content-between",
    "around": "content-around",
    "evenly": "content-evenly"
   },
   "gridAutoFlow": {
    "row": "",
    "col": "grid-flow-col",
    "dense": "grid-flow-dense",
    "row_dense": "grid-flow-row-dense",
    "col_dense": "grid-flow-col-dense"
   },
   "marginTop": {
    "none": "mt-0",
    "mt_16": "mt-4",
    "mt_32": "mt-8",
    "mt_48": "mt-12",
    "mt_64": "mt-16",
    "mt_80": "mt-20",
    "mt_96": "mt-24",
    "mt_112": "mt-28",
    "mt_128": "mt-32"
   },
   "marginTopMd": {
    "inherit": "",
    "none": "md:mt-0",
    "mt_16": "md:mt-4",
    "mt_32": "md:mt-8",
    "mt_48": "md:mt-12",
    "mt_64": "md:mt-16",
    "mt_80": "md:mt-20",
    "mt_96": "md:mt-24",
    "mt_112": "md:mt-28",
    "mt_128": "md:mt-32"
   },
   "marginTopLg": {
    "inherit": "",
    "none": "min-[1024px]:mt-0",
    "mt_16": "min-[1024px]:mt-4",
    "mt_32": "min-[1024px]:mt-8",
    "mt_48": "min-[1024px]:mt-12",
    "mt_64": "min-[1024px]:mt-16",
    "mt_80": "min-[1024px]:mt-20",
    "mt_96": "min-[1024px]:mt-24",
    "mt_112": "min-[1024px]:mt-28",
    "mt_128": "min-[1024px]:mt-32"
   },
   "marginBottom": {
    "none": "mb-0",
    "mb_16": "mb-4",
    "mb_32": "mb-8",
    "mb_48": "mb-12",
    "mb_64": "mb-16",
    "mb_80": "mb-20",
    "mb_96": "mb-24",
    "mb_112": "mb-28",
    "mb_128": "mb-32"
   },
   "marginBottomMd": {
    "inherit": "",
    "none": "md:mb-0",
    "mb_16": "md:mb-4",
    "mb_32": "md:mb-8",
    "mb_48": "md:mb-12",
    "mb_64": "md:mb-16",
    "mb_80": "md:mb-20",
    "mb_96": "md:mb-24",
    "mb_112": "md:mb-28",
    "mb_128": "md:mb-32"
   },
   "marginBottomLg": {
    "inherit": "",
    "none": "min-[1024px]:mb-0",
    "mb_16": "min-[1024px]:mb-4",
    "mb_32": "min-[1024px]:mb-8",
    "mb_48": "min-[1024px]:mb-12",
    "mb_64": "min-[1024px]:mb-16",
    "mb_80": "min-[1024px]:mb-20",
    "mb_96": "min-[1024px]:mb-24",
    "mb_112": "min-[1024px]:mb-28",
    "mb_128": "min-[1024px]:mb-32"
   },
   "spacing": {
    "default": "py-8",
    "compact": "py-4",
    "loose": "py-16",
    "none": "py-0",
    "extra_small": "py-2"
   },
   "background": {
    "default": "bg-transparent",
    "transparent": "bg-transparent",
    "white": "bg-primary-1",
    "neutral": "bg-tertiary-2",
    "green": "bg-primary-lfgreen",
    "blue": "bg-secondary-ltblue",
    "dark_forest": "bg-secondary-darkfir text-white",
    "dark_green": "bg-secondary-darkfir text-white",
    "mid_green": "bg-(--color-green-grass)",
    "mid_dark_green": "bg-(--color-fir-midfir) text-white",
    "light_dark_green": "bg-(--color-fir-lightfir) text-white",
    "light_pink": "bg-(--color-pink-ltpink)",
    "dark_pink": "bg-(--color-tertiary-darkpink) text-white",
    "dark_blue": "bg-(--color-tertiary-darkblue) text-white",
    "mid_neutral": "bg-(--color-neutral-4)"
   },
   "separators": {
    "none": "",
    "vertical": "row-separators-vertical"
   },
   "paddingX": {
    "none": "px-0",
    "sm": "px-2",
    "md": "px-4",
    "lg": "px-6",
    "xl": "px-8",
    "xxl": "px-12"
   },
   "paddingXMd": {
    "inherit": "",
    "none": "md:px-0",
    "sm": "md:px-2",
    "md": "md:px-4",
    "lg": "md:px-6",
    "xl": "md:px-8",
    "xxl": "md:px-12"
   },
   "paddingXLg": {
    "inherit": "",
    "none": "min-[1024px]:px-0",
    "sm": "min-[1024px]:px-2",
    "md": "min-[1024px]:px-4",
    "lg": "min-[1024px]:px-6",
    "xl": "min-[1024px]:px-8",
    "xxl": "min-[1024px]:px-12"
   },
   "paddingY": {
    "none": "py-0",
    "sm": "py-2",
    "md": "py-4",
    "lg": "py-6",
    "xl": "py-8",
    "xxl": "py-12"
   },
   "paddingYMd": {
    "inherit": "",
    "none": "md:py-0",
    "sm": "md:py-2",
    "md": "md:py-4",
    "lg": "md:py-6",
    "xl": "md:py-8",
    "xxl": "md:py-12"
   },
   "paddingYLg": {
    "inherit": "",
    "none": "min-[1024px]:py-0",
    "sm": "min-[1024px]:py-2",
    "md": "min-[1024px]:py-4",
    "lg": "min-[1024px]:py-6",
    "xl": "min-[1024px]:py-8",
    "xxl": "min-[1024px]:py-12"
   },
   "borderRadius": {
    "none": "",
    "sm": "rounded-xxs",
    "md": "rounded-xs",
    "lg": "rounded-[16px]",
    "xl": "rounded-default",
    "xxl": "rounded-[35px]"
   },
   "borderRadiusMd": {
    "inherit": "",
    "none": "",
    "sm": "md:rounded-xxs",
    "md": "md:rounded-xs",
    "lg": "md:rounded-[16px]",
    "xl": "md:rounded-default",
    "xxl": "md:rounded-[35px]"
   },
   "borderRadiusLg": {
    "inherit": "",
    "none": "",
    "sm": "min-[1024px]:rounded-xxs",
    "md": "min-[1024px]:rounded-xs",
    "lg": "min-[1024px]:rounded-[16px]",
    "xl": "min-[1024px]:rounded-default",
    "xxl": "min-[1024px]:rounded-[35px]"
   }
  },
  "defaultVariants": {
   "displayMode": "flex",
   "spacing": "default",
   "background": "default",
   "separators": "none",
   "borderRadius": "none"
  }
 },
 "column": {
  "base": "flex flex-1 flex-col flex-nowrap justify-start",
  "variants": {
   "colSpan": {
    "auto": "",
    "full": "col-span-full",
    "span_1": "col-span-1",
    "span_2": "col-span-2",
    "span_3": "col-span-3",
    "span_4": "col-span-4",
    "span_5": "col-span-5",
    "span_6": "col-span-6",
    "span_7": "col-span-7",
    "span_8": "col-span-8",
    "span_9": "col-span-9",
    "span_10": "col-span-10",
    "span_11": "col-span-11",
    "span_12": "col-span-12"
   },
   "colSpanMd": {
    "inherit": "",
    "auto": "md:col-auto",
    "full": "md:col-span-full",
    "span_1": "md:col-span-1",
    "span_2": "md:col-span-2",
    "span_3": "md:col-span-3",
    "span_4": "md:col-span-4",
    "span_5": "md:col-span-5",
    "span_6": "md:col-span-6",
    "span_7": "md:col-span-7",
    "span_8": "md:col-span-8",
    "span_9": "md:col-span-9",
    "span_10": "md:col-span-10",
    "span_11": "md:col-span-11",
    "span_12": "md:col-span-12"
   },
   "colSpanLg": {
    "inherit": "",
    "auto": "min-[1024px]:col-auto",
    "full": "min-[1024px]:col-span-full",
    "span_1": "min-[1024px]:col-span-1",
    "span_2": "min-[1024px]:col-span-2",
    "span_3": "min-[1024px]:col-span-3",
    "span_4": "min-[1024px]:col-span-4",
    "span_5": "min-[1024px]:col-span-5",
    "span_6": "min-[1024px]:col-span-6",
    "span_7": "min-[1024px]:col-span-7",
    "span_8": "min-[1024px]:col-span-8",
    "span_9": "min-[1024px]:col-span-9",
    "span_10": "min-[1024px]:col-span-10",
    "span_11": "min-[1024px]:col-span-11",
    "span_12": "min-[1024px]:col-span-12"
   },
   "colStart": {
    "auto": "",
    "start_1": "col-start-1",
    "start_2": "col-start-2",
    "start_3": "col-start-3",
    "start_4": "col-start-4",
    "start_5": "col-start-5",
    "start_6": "col-start-6",
    "start_7": "col-start-7",
    "start_8": "col-start-8",
    "start_9": "col-start-9",
    "start_10": "col-start-10",
    "start_11": "col-start-11",
    "start_12": "col-start-12",
    "start_13": "col-start-13"
   },
   "colStartMd": {
    "inherit": "",
    "auto": "md:col-start-1",
    "start_1": "md:col-start-1",
    "start_2": "md:col-start-2",
    "start_3": "md:col-start-3",
    "start_4": "md:col-start-4",
    "start_5": "md:col-start-5",
    "start_6": "md:col-start-6",
    "start_7": "md:col-start-7",
    "start_8": "md:col-start-8",
    "start_9": "md:col-start-9",
    "start_10": "md:col-start-10",
    "start_11": "md:col-start-11",
    "start_12": "md:col-start-12",
    "start_13": "md:col-start-13"
   },
   "colStartLg": {
    "inherit": "",
    "auto": "min-[1024px]:col-start-auto",
    "start_1": "min-[1024px]:col-start-1",
    "start_2": "min-[1024px]:col-start-2",
    "start_3": "min-[1024px]:col-start-3",
    "start_4": "min-[1024px]:col-start-4",
    "start_5": "min-[1024px]:col-start-5",
    "start_6": "min-[1024px]:col-start-6",
    "start_7": "min-[1024px]:col-start-7",
    "start_8": "min-[1024px]:col-start-8",
    "start_9": "min-[1024px]:col-start-9",
    "start_10": "min-[1024px]:col-start-10",
    "start_11": "min-[1024px]:col-start-11",
    "start_12": "min-[1024px]:col-start-12",
    "start_13": "min-[1024px]:col-start-13"
   },
   "colEnd": {
    "auto": "",
    "end_1": "col-end-1",
    "end_2": "col-end-2",
    "end_3": "col-end-3",
    "end_4": "col-end-4",
    "end_5": "col-end-5",
    "end_6": "col-end-6",
    "end_7": "col-end-7",
    "end_8": "col-end-8",
    "end_9": "col-end-9",
    "end_10": "col-end-10",
    "end_11": "col-end-11",
    "end_12": "col-end-12",
    "end_13": "col-end-13"
   },
   "rowSpan": {
    "auto": "",
    "full": "row-span-full",
    "row_span_1": "row-span-1",
    "row_span_2": "row-span-2",
    "row_span_3": "row-span-3",
    "row_span_4": "row-span-4",
    "row_span_5": "row-span-5",
    "row_span_6": "row-span-6"
   },
   "rowSpanMd": {
    "inherit": "",
    "auto": "md:row-auto",
    "full": "md:row-span-full",
    "row_span_1": "md:row-span-1",
    "row_span_2": "md:row-span-2",
    "row_span_3": "md:row-span-3",
    "row_span_4": "md:row-span-4",
    "row_span_5": "md:row-span-5",
    "row_span_6": "md:row-span-6"
   },
   "rowSpanLg": {
    "inherit": "",
    "auto": "min-[1024px]:row-auto",
    "full": "min-[1024px]:row-span-full",
    "row_span_1": "min-[1024px]:row-span-1",
    "row_span_2": "min-[1024px]:row-span-2",
    "row_span_3": "min-[1024px]:row-span-3",
    "row_span_4": "min-[1024px]:row-span-4",
    "row_span_5": "min-[1024px]:row-span-5",
    "row_span_6": "min-[1024px]:row-span-6"
   },
   "rowStart": {
    "auto": "",
    "row_start_1": "row-start-1",
    "row_start_2": "row-start-2",
    "row_start_3": "row-start-3",
    "row_start_4": "row-start-4",
    "row_start_5": "row-start-5",
    "row_start_6": "row-start-6",
    "row_start_7": "row-start-7"
   },
   "rowStartMd": {
    "inherit": "",
    "auto": "md:row-start-auto",
    "row_start_1": "md:row-start-1",
    "row_start_2": "md:row-start-2",
    "row_start_3": "md:row-start-3",
    "row_start_4": "md:row-start-4",
    "row_start_5": "md:row-start-5",
    "row_start_6": "md:row-start-6",
    "row_start_7": "md:row-start-7"
   },
   "rowStartLg": {
    "inherit": "",
    "auto": "min-[1024px]:row-start-auto",
    "row_start_1": "min-[1024px]:row-start-1",
    "row_start_2": "min-[1024px]:row-start-2",
    "row_start_3": "min-[1024px]:row-start-3",
    "row_start_4": "min-[1024px]:row-start-4",
    "row_start_5": "min-[1024px]:row-start-5",
    "row_start_6": "min-[1024px]:row-start-6",
    "row_start_7": "min-[1024px]:row-start-7"
   },
   "rowEnd": {
    "auto": "",
    "row_end_1": "row-end-1",
    "row_end_2": "row-end-2",
    "row_end_3": "row-end-3",
    "row_end_4": "row-end-4",
    "row_end_5": "row-end-5",
    "row_end_6": "row-end-6",
    "row_end_7": "row-end-7"
   },
   "rowEndMd": {
    "inherit": "",
    "auto": "md:row-end-auto",
    "row_end_1": "md:row-end-1",
    "row_end_2": "md:row-end-2",
    "row_end_3": "md:row-end-3",
    "row_end_4": "md:row-end-4",
    "row_end_5": "md:row-end-5",
    "row_end_6": "md:row-end-6",
    "row_end_7": "md:row-end-7"
   },
   "rowEndLg": {
    "inherit": "",
    "auto": "min-[1024px]:row-end-auto",
    "row_end_1": "min-[1024px]:row-end-1",
    "row_end_2": "min-[1024px]:row-end-2",
    "row_end_3": "min-[1024px]:row-end-3",
    "row_end_4": "min-[1024px]:row-end-4",
    "row_end_5": "min-[1024px]:row-end-5",
    "row_end_6": "min-[1024px]:row-end-6",
    "row_end_7": "min-[1024px]:row-end-7"
   },
   "gap": {
    "none": "",
    "xs": "gap-1",
    "sm": "gap-2",
    "md": "gap-4",
    "lg": "gap-6",
    "xl": "gap-8",
    "xxl": "gap-12"
   },
   "contentAlign": {
    "start": "items-start",
    "center": "items-center",
    "end": "items-end",
    "stretch": ""
   },
   "justifyContent": {
    "start": "",
    "center": "justify-center",
    "end": "justify-end",
    "between": "justify-between"
   },
   "justifySelf": {
    "auto": "",
    "start": "justify-self-start",
    "center": "justify-self-center",
    "end": "justify-self-end",
    "stretch": "justify-self-stretch"
   },
   "alignSelf": {
    "auto": "",
    "start": "self-start",
    "center": "self-center",
    "end": "self-end",
    "stretch": "self-stretch",
    "baseline": "self-baseline"
   },
   "order": {
    "none": "",
    "first": "order-first",
    "last": "order-last",
    "order_1": "order-1",
    "order_2": "order-2",
    "order_3": "order-3",
    "order_4": "order-4",
    "order_5": "order-5",
    "order_6": "order-6",
    "order_7": "order-7",
    "order_8": "order-8",
    "order_9": "order-9",
    "order_10": "order-10",
    "order_11": "order-11",
    "order_12": "order-12"
   },
   "background": {
    "transparent": "",
    "white": "bg-primary-1",
    "neutral": "bg-tertiary-2",
    "green": "bg-primary-lfgreen",
    "light_blue": "bg-secondary-ltblue",
    "dark_forest": "bg-secondary-darkfir text-white",
    "dark_green": "bg-secondary-darkfir text-white",
    "mid_green": "bg-(--color-green-grass)",
    "mid_dark_green": "bg-(--color-fir-midfir) text-white",
    "light_dark_green": "bg-(--color-fir-lightfir) text-white",
    "light_pink": "bg-(--color-pink-ltpink)",
    "dark_pink": "bg-(--color-tertiary-darkpink) text-white",
    "dark_blue": "bg-(--color-tertiary-darkblue) text-white",
    "mid_neutral": "bg-(--color-neutral-4)"
   },
   "borderRadius": {
    "none": "",
    "sm": "rounded-xxs",
    "md": "rounded-xs",
    "lg": "rounded-[16px]",
    "xxl": "rounded-default"
   },
   "borderRadiusMd": {
    "inherit": "",
    "none": "md:rounded-none",
    "sm": "md:rounded-xxs",
    "md": "md:rounded-xs",
    "lg": "md:rounded-[16px]",
    "xxl": "md:rounded-default"
   },
   "borderRadiusLg": {
    "inherit": "",
    "none": "min-[1024px]:rounded-none",
    "sm": "min-[1024px]:rounded-xxs",
    "md": "min-[1024px]:rounded-xs",
    "lg": "min-[1024px]:rounded-[16px]",
    "xxl": "min-[1024px]:rounded-default"
   },
   "hideMobile": {
    "true": "",
    "false": ""
   },
   "hideTablet": {
    "true": "",
    "false": ""
   },
   "hideDesktop": {
    "true": "",
    "false": ""
   },
   "padding": {
    "none": "",
    "xs": "p-2",
    "sm": "p-3",
    "md": "p-4",
    "lg": "p-6",
    "xl": "p-8",
    "xxl": "p-12"
   },
   "paddingMd": {
    "inherit": "",
    "none": "md:p-0",
    "xs": "md:p-2",
    "sm": "md:p-3",
    "md": "md:p-4",
    "lg": "md:p-6",
    "xl": "md:p-8",
    "xxl": "md:p-12"
   },
   "paddingLg": {
    "inherit": "",
    "none": "min-[1024px]:p-0",
    "xs": "min-[1024px]:p-2",
    "sm": "min-[1024px]:p-3",
    "md": "min-[1024px]:p-4",
    "lg": "min-[1024px]:p-6",
    "xl": "min-[1024px]:p-8",
    "xxl": "min-[1024px]:p-12"
   }
  },
  "compoundVariants": [
   {
    "hideMobile": true,
    "hideTablet": false,
    "hideDesktop": false,
    "class": "hidden md:flex"
   },
   {
    "hideMobile": false,
    "hideTablet": true,
    "hideDesktop": false,
    "class": "md:hidden min-[1024px]:flex"
   },
   {
    "hideMobile": false,
    "hideTablet": false,
    "hideDesktop": true,
    "class": "min-[1024px]:hidden"
   },
   {
    "hideMobile": true,
    "hideTablet": true,
    "hideDesktop": false,
    "class": "hidden min-[1024px]:flex"
   },
   {
    "hideMobile": true,
    "hideTablet": false,
    "hideDesktop": true,
    "class": "hidden md:flex min-[1024px]:hidden"
   },
   {
    "hideMobile": false,
    "hideTablet": true,
    "hideDesktop": true,
    "class": "md:hidden"
   },
   {
    "hideMobile": true,
    "hideTablet": true,
    "hideDesktop": true,
    "class": "hidden"
   }
  ],
  "defaultVariants": {
   "hideMobile": false,
   "hideTablet": false,
   "hideDesktop": false
  }
 }
} as const

/** Row gap maps. Prod keeps these outside the row's cva(): columnGap / rowGap each fall back to gap. */
export const PROD_ROW_GAPS = {
 "colGap": {
  "none": "gap-x-0",
  "xs": "gap-x-2",
  "sm": "gap-x-4",
  "md": "gap-x-6",
  "lg": "gap-x-8",
  "xl": "gap-x-12",
  "xxl": "gap-x-24",
  "xxxl": "gap-x-36"
 },
 "colGapMd": {
  "none": "md:gap-x-0",
  "xs": "md:gap-x-2",
  "sm": "md:gap-x-4",
  "md": "md:gap-x-6",
  "lg": "md:gap-x-8",
  "xl": "md:gap-x-12",
  "xxl": "md:gap-x-24",
  "xxxl": "md:gap-x-36"
 },
 "colGapLg": {
  "none": "min-[1024px]:gap-x-0",
  "xs": "min-[1024px]:gap-x-2",
  "sm": "min-[1024px]:gap-x-4",
  "md": "min-[1024px]:gap-x-6",
  "lg": "min-[1024px]:gap-x-8",
  "xl": "min-[1024px]:gap-x-12",
  "xxl": "min-[1024px]:gap-x-24",
  "xxxl": "min-[1024px]:gap-x-36"
 },
 "rowGap": {
  "none": "gap-y-0",
  "xs": "gap-y-2",
  "sm": "gap-y-4",
  "md": "gap-y-6",
  "lg": "gap-y-8",
  "xl": "gap-y-12",
  "xxl": "gap-y-24",
  "xxxl": "gap-y-36"
 },
 "rowGapMd": {
  "none": "md:gap-y-0",
  "xs": "md:gap-y-2",
  "sm": "md:gap-y-4",
  "md": "md:gap-y-6",
  "lg": "md:gap-y-8",
  "xl": "md:gap-y-12",
  "xxl": "md:gap-y-24",
  "xxxl": "md:gap-y-36"
 },
 "rowGapLg": {
  "none": "min-[1024px]:gap-y-0",
  "xs": "min-[1024px]:gap-y-2",
  "sm": "min-[1024px]:gap-y-4",
  "md": "min-[1024px]:gap-y-6",
  "lg": "min-[1024px]:gap-y-8",
  "xl": "min-[1024px]:gap-y-12",
  "xxl": "min-[1024px]:gap-y-24",
  "xxxl": "min-[1024px]:gap-y-36"
 },
 "clGap": {
  "none": "0px",
  "xs": "8px",
  "sm": "16px",
  "md": "24px",
  "lg": "32px",
  "xl": "48px",
  "xxl": "96px",
  "xxxl": "144px"
 }
} as const
