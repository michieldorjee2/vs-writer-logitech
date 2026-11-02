import { cn, decodeText, slugify } from '../../../lib/utils'
import { parseBoolean } from '../../../lib/optimizely/types/display-settings'
import { StackedTextIsland } from './stacked-text-island'
import { CurvedLineIsland } from './curved-line-island'
import { StaticStackedText } from './static-stacked-text'
import {
  StackedHeadingElementFragment,
  type StackedHeadingProps,
  type StackedHeadingElementProps,
  type StackedHeadingElementDisplaySettings,
  type DisplayLevel,
  type TextPart,
  type HeadingLevel,
  type AnimationMode,
  type TextAlignment,
  type FontFamily,
} from './types'

export {
  StackedHeadingElementFragment,
  type StackedHeadingElementProps,
  type StackedHeadingElementDisplaySettings,
}

interface ParsedRichText {
  text: string
  alignment: TextAlignment
}

function parseRichTextHtml(html: string): ParsedRichText {
  let alignment: TextAlignment = 'left'

  const centerMatch =
    html.match(/text-align:\s*center/i) ||
    html.match(/class="[^"]*text-center[^"]*"/i)
  const rightMatch =
    html.match(/text-align:\s*right/i) ||
    html.match(/class="[^"]*text-right[^"]*"/i)

  if (centerMatch) {
    alignment = 'center'
  } else if (rightMatch) {
    alignment = 'right'
  }

  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')

  text = decodeText(text.replace(/<[^>]*>/g, '')).trim()

  text = text.replace(/\n{3,}/g, '\n\n')

  return { text, alignment }
}

function parseStackedText(text: string): TextPart[] {
  const regex = /##(.+?)##/g
  const parts: TextPart[] = []
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'stacked', content: match[1] })
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) })
  }

  return parts
}

const ALIGNMENT_CLASSES: Record<TextAlignment, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

const MARGIN_BOTTOM_CLASSES = {
  none: '',
  xs: 'mb-1',
  sm: 'mb-2',
  md: 'mb-4',
  lg: 'mb-6',
  xl: 'mb-8',
  xxl: 'mb-12',
} as const

const COLOR_CLASSES = {
  // Inherit follows --prose-type-color, the same variable section/row/column
  // backgrounds drive for prose text -- dark-fir on light, white on dark. This
  // makes the heading track its container color exactly like other text.
  inherit: 'text-(--prose-type-color)',
  default: 'text-(--prose-type-color)',
  dark: 'text-(--color-secondary-darkfir)',
  white: 'text-white',
  lfgreen: 'text-(--color-primary-lfgreen)',
} as const

export type ColorScheme = keyof typeof COLOR_CLASSES

const DISPLAY_SIZE_CLASSES: Record<DisplayLevel, string> = {
  h1: 'text-5xl md:text-7xl lg:text-12xl',
  h2: 'text-4xl md:text-6xl lg:text-10xl',
  h3: 'text-3xl md:text-5xl lg:text-8xl',
  h4: 'text-2xl md:text-4xl lg:text-7xl',
  h5: 'text-xl md:text-3xl lg:text-5xl',
  h6: 'text-lg md:text-2xl lg:text-4xl',
}

const FONT_FAMILY_CLASSES: Record<FontFamily, string> = {
  nudge: 'font-nudge',
  henrietta: 'font-henrietta',
}

const FONT_SIZE_CLASS_MAP: Record<string, string> = {
  text_4xl: 'text-4xl',
  text_5xl: 'text-5xl',
  text_6xl: 'text-6xl',
  text_7xl: 'text-7xl',
  text_8xl: 'text-8xl',
  text_9xl: 'text-9xl',
  text_10xl: 'text-10xl',
  text_11xl: 'text-11xl',
  text_12xl: 'text-12xl',
  text_13xl: 'text-13xl',
  text_14xl: 'text-14xl',
  text_14_5xl: 'text-[140px]',
  text_15xl: 'text-15xl',
  md_text_4xl: 'md:text-4xl',
  md_text_5xl: 'md:text-5xl',
  md_text_6xl: 'md:text-6xl',
  md_text_7xl: 'md:text-7xl',
  md_text_8xl: 'md:text-8xl',
  md_text_9xl: 'md:text-9xl',
  md_text_10xl: 'md:text-10xl',
  md_text_11xl: 'md:text-11xl',
  md_text_12xl: 'md:text-12xl',
  md_text_13xl: 'md:text-13xl',
  md_text_14xl: 'md:text-14xl',
  md_text_14_5xl: 'md:text-[140px]',
  md_text_15xl: 'md:text-15xl',
  lg_text_4xl: 'lg:text-4xl',
  lg_text_5xl: 'lg:text-5xl',
  lg_text_6xl: 'lg:text-6xl',
  lg_text_7xl: 'lg:text-7xl',
  lg_text_8xl: 'lg:text-8xl',
  lg_text_9xl: 'lg:text-9xl',
  lg_text_10xl: 'lg:text-10xl',
  lg_text_11xl: 'lg:text-11xl',
  lg_text_12xl: 'lg:text-12xl',
  lg_text_13xl: 'lg:text-13xl',
  lg_text_14xl: 'lg:text-14xl',
  lg_text_14_5xl: 'lg:text-[117px]',
  lg_text_15xl: 'lg:text-15xl',
  xxl_text_4xl: '2xl:text-4xl',
  xxl_text_5xl: '2xl:text-5xl',
  xxl_text_6xl: '2xl:text-6xl',
  xxl_text_7xl: '2xl:text-7xl',
  xxl_text_8xl: '2xl:text-8xl',
  xxl_text_9xl: '2xl:text-9xl',
  xxl_text_10xl: '2xl:text-10xl',
  xxl_text_11xl: '2xl:text-11xl',
  xxl_text_12xl: '2xl:text-12xl',
  xxl_text_13xl: '2xl:text-13xl',
  xxl_text_14xl: '2xl:text-14xl',
  xxl_text_14_5xl: '2xl:text-[140px]',
  xxl_text_15xl: '2xl:text-15xl',
}

// Big display sizes (96/120/160px = text-13xl/14xl/15xl) read better with a
// looser line-height; everything smaller keeps the tight 0.9 display leading.
const isBigDisplaySize = (value?: string): boolean =>
  !!value && /_(1[345]xl|14_5xl)$/.test(value)

const breakpointLeadingClass = (
  sizeValue: string | undefined,
  prefix: '' | 'md:' | 'lg:' | '2xl:',
  curved: boolean
): string | null => {
  if (!sizeValue || sizeValue === 'default') return null
  const base = isBigDisplaySize(sizeValue) ? 1.5 : 0.9
  return `${prefix}leading-[${(base + (curved ? 1 : 0)).toFixed(1)}]`
}

const PADDING_TOP_CLASSES: Record<string, string> = {
  none: 'pt-0',
  sm: 'pt-2',
  md: 'pt-4',
  lg: 'pt-6',
  xl: 'pt-8',
  xxl: 'pt-12',
}

const PADDING_TOP_LG_CLASSES: Record<string, string> = {
  none: 'lg:pt-0',
  sm: 'lg:pt-2',
  md: 'lg:pt-4',
  lg: 'lg:pt-6',
  xl: 'lg:pt-8',
  xxl: 'lg:pt-12',
}

const PADDING_RIGHT_CLASSES: Record<string, string> = {
  none: 'pr-0',
  sm: 'pr-2',
  md: 'pr-4',
  lg: 'pr-6',
  xl: 'pr-8',
  xxl: 'pr-12',
}

const PADDING_RIGHT_LG_CLASSES: Record<string, string> = {
  none: 'lg:pr-0',
  sm: 'lg:pr-2',
  md: 'lg:pr-4',
  lg: 'lg:pr-6',
  xl: 'lg:pr-8',
  xxl: 'lg:pr-12',
}

const PADDING_BOTTOM_CLASSES: Record<string, string> = {
  none: 'pb-0',
  sm: 'pb-2',
  md: 'pb-4',
  lg: 'pb-6',
  xl: 'pb-8',
  xxl: 'pb-12',
}

const PADDING_BOTTOM_LG_CLASSES: Record<string, string> = {
  none: 'lg:pb-0',
  sm: 'lg:pb-2',
  md: 'lg:pb-4',
  lg: 'lg:pb-6',
  xl: 'lg:pb-8',
  xxl: 'lg:pb-12',
}

const PADDING_LEFT_CLASSES: Record<string, string> = {
  none: 'pl-0',
  sm: 'pl-2',
  md: 'pl-4',
  lg: 'pl-6',
  xl: 'pl-8',
  xxl: 'pl-12',
}

const PADDING_LEFT_LG_CLASSES: Record<string, string> = {
  none: 'lg:pl-0',
  sm: 'lg:pl-2',
  md: 'lg:pl-4',
  lg: 'lg:pl-6',
  xl: 'lg:pl-8',
  xxl: 'lg:pl-12',
}

const HAS_STACKED_MARKER = /##.+?##/

export function StackedHeading({
  text,
  as: Tag = 'h1',
  displayAs,
  className,
  animationMode = 'mouse',
  alignment = 'left',
  colorScheme = 'inherit',
  curved = false,
  arcAmount = 0.3,
  extrusionCount = 5,
  fontFamily = 'nudge',
  fontSizeOverrides,
  leadingOverrides,
  id,
}: StackedHeadingProps) {
  // Decode HTML entities (e.g. &rsquo;, &amp;, &#8217;) here so every consumer
  // is covered -- including templates/blocks that pass a raw `text` prop and
  // bypass parseRichTextHtml. Idempotent for the element path, which already
  // decodes when stripping rich-text markup.
  const decodedText = decodeText(text)
  const lines = decodedText.split('\n').filter((line) => line.trim() !== '')
  const hasStacked = HAS_STACKED_MARKER.test(decodedText)
  const sizeClasses = fontSizeOverrides
    ? fontSizeOverrides
    : displayAs
      ? DISPLAY_SIZE_CLASSES[displayAs]
      : DISPLAY_SIZE_CLASSES.h1

  return (
    <Tag
      id={id}
      data-display-level={fontSizeOverrides ? undefined : (displayAs ?? 'h1')}
      className={cn(
        'w-full font-extrabold tracking-[-0.01em]',
        FONT_FAMILY_CLASSES[fontFamily],
        sizeClasses,
        // leading after sizeClasses: Tailwind v4 text-{size} carries a default
        // line-height, so tailwind-merge drops a leading-* placed before it.
        // Base 0.9, with per-breakpoint overrides loosening big sizes to 1.5.
        // Curved headings add 1.0 to every line-height (0.9->1.9, 1.5->2.5).
        curved ? 'leading-[1.9]' : 'leading-none',
        leadingOverrides,
        ALIGNMENT_CLASSES[alignment],
        className,
        'z-1',
        COLOR_CLASSES[colorScheme]
      )}
    >
      {lines.map((line, lineIndex) => {
        if (!hasStacked) {
          return (
            <span key={lineIndex} className="block">
              {line}
            </span>
          )
        }

        const parts = parseStackedText(line)

        if (curved) {
          return (
            <span key={lineIndex} className="block">
              <CurvedLineIsland
                parts={parts}
                animationMode={animationMode}
                arcAmount={arcAmount}
                extrusionCount={extrusionCount}
              >
                <span className="block w-full text-center">
                  <StaticStackedText
                    text={parts.map((part) => part.content).join('')}
                    extrusionCount={extrusionCount}
                    className="z-10"
                  />
                </span>
              </CurvedLineIsland>
            </span>
          )
        }

        return (
          <span key={lineIndex} className="block">
            {parts.map((part, partIndex) =>
              part.type === 'stacked' ? (
                <span
                  key={partIndex}
                  className="inline-block origin-bottom-left"
                >
                  <StackedTextIsland
                    text={part.content}
                    animationMode={animationMode}
                    extrusionCount={extrusionCount}
                  >
                    <StaticStackedText
                      text={part.content}
                      extrusionCount={extrusionCount}
                    />
                  </StackedTextIsland>
                </span>
              ) : (
                <span key={partIndex} className="relative z-10">
                  {part.content}
                </span>
              )
            )}
          </span>
        )
      })}
    </Tag>
  )
}

export default function StackedHeadingElement({
  Text,
  HeadingLevel,
  DisplayAs,
  Anchor,
  displaySettings,
}: StackedHeadingElementProps) {
  const {
    colorScheme,
    marginBottom,
    animationMode,
    curvedText,
    arcAmount,
    extrusionCount,
    fontFamily,
    fontSizeMobile,
    fontSizeMd,
    fontSizeLg,
    fontSize2xl,
    alignment,
    paddingTop,
    paddingTopLg,
    paddingRight,
    paddingRightLg,
    paddingBottom,
    paddingBottomLg,
    paddingLeft,
    paddingLeftLg,
  } = displaySettings ?? {}

  const parsed = Text?.html ? parseRichTextHtml(Text.html) : null

  if (!parsed?.text) {
    return null
  }
  const headingLevel = (HeadingLevel as HeadingLevel) || 'h1'
  const mode = (animationMode as AnimationMode) || 'mouse'
  const curved = parseBoolean(curvedText)
  const arc = arcAmount
    ? parseInt(arcAmount.replace('arc_', ''), 10) / 100
    : 0.3
  const layers = extrusionCount
    ? parseInt(extrusionCount.replace('layers_', ''), 10)
    : 5
  const color = (colorScheme as ColorScheme) || 'inherit'
  const mbKey = (marginBottom as keyof typeof MARGIN_BOTTOM_CLASSES) || 'none'
  const mbClass = MARGIN_BOTTOM_CLASSES[mbKey] ?? ''
  const font = (fontFamily as FontFamily) || 'nudge'

  let alignmentText: TextAlignment = parsed.alignment
  if (alignment) {
    alignmentText = (alignment as TextAlignment) || 'left'
  }
  const fontSizeClasses = [
    fontSizeMobile && fontSizeMobile !== 'default'
      ? FONT_SIZE_CLASS_MAP[fontSizeMobile]
      : null,
    fontSizeMd && fontSizeMd !== 'default'
      ? FONT_SIZE_CLASS_MAP[fontSizeMd]
      : null,
    fontSizeLg && fontSizeLg !== 'default'
      ? FONT_SIZE_CLASS_MAP[fontSizeLg]
      : null,
    fontSize2xl && fontSize2xl !== 'default'
      ? FONT_SIZE_CLASS_MAP[fontSize2xl]
      : null,
  ]
    .filter(Boolean)
    .join(' ')

  // Line-height tracks the chosen size per breakpoint: the largest display
  // sizes (96/120/160) loosen to 1.5, everything smaller stays at 0.9.
  const leadingOverrides = [
    breakpointLeadingClass(fontSizeMobile, '', curved),
    breakpointLeadingClass(fontSizeMd, 'md:', curved),
    breakpointLeadingClass(fontSizeLg, 'lg:', curved),
    breakpointLeadingClass(fontSize2xl, '2xl:', curved),
  ]
    .filter(Boolean)
    .join(' ')

  const displayLevel = (DisplayAs as DisplayLevel) || undefined

  const anchorId = Anchor ? slugify(Anchor) : undefined

  const paddingClasses = cn(
    paddingTop && PADDING_TOP_CLASSES[paddingTop],
    paddingTopLg &&
      paddingTopLg !== 'inherit' &&
      PADDING_TOP_LG_CLASSES[paddingTopLg],
    paddingRight && PADDING_RIGHT_CLASSES[paddingRight],
    paddingRightLg &&
      paddingRightLg !== 'inherit' &&
      PADDING_RIGHT_LG_CLASSES[paddingRightLg],
    paddingBottom && PADDING_BOTTOM_CLASSES[paddingBottom],
    paddingBottomLg &&
      paddingBottomLg !== 'inherit' &&
      PADDING_BOTTOM_LG_CLASSES[paddingBottomLg],
    paddingLeft && PADDING_LEFT_CLASSES[paddingLeft],
    paddingLeftLg &&
      paddingLeftLg !== 'inherit' &&
      PADDING_LEFT_LG_CLASSES[paddingLeftLg]
  )

  const heading = (
    <StackedHeading
      text={parsed.text}
      as={headingLevel}
      displayAs={displayLevel}
      colorScheme={color}
      className={mbClass || undefined}
      animationMode={mode}
      alignment={alignmentText}
      curved={curved}
      arcAmount={arc}
      extrusionCount={layers}
      fontFamily={font}
      fontSizeOverrides={fontSizeClasses || undefined}
      leadingOverrides={leadingOverrides || undefined}
      id={anchorId}
    />
  )

  if (!paddingClasses) {
    return heading
  }

  return <div className={paddingClasses}>{heading}</div>
}

export type {
  AnimationMode,
  DisplayLevel,
  FontFamily,
  HeadingLevel,
  StackedHeadingProps,
  StackedTextProps,
  TextAlignment,
  TextPart,
} from './types'
