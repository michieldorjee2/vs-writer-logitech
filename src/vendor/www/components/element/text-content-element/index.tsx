import { cn } from '../../../lib/utils'
import { EditableHtml } from '../../../lib/optimizely/features/draft'
import { parseBoolean } from '../../../lib/optimizely/types/display-settings'
import {
  TextContentElementFragment,
  type TextContentElementProps,
} from './types'

export { TextContentElementFragment, type TextContentElementProps }

const COLOR_CLASSES = {
  default: '',
  dark: 'text-(--color-secondary-darkfir)',
  white: 'text-white',
  lfgreen: 'text-(--color-primary-lfgreen)',
} as const

const PADDING_X_CLASSES: Record<string, string> = {
  none: 'px-0',
  sm: 'px-2',
  md: 'px-4',
  lg: 'px-6',
}

const PADDING_X_MD_CLASSES: Record<string, string> = {
  none: 'md:px-0',
  sm: 'md:px-2',
  md: 'md:px-4',
  lg: 'md:px-6',
}

const PADDING_X_LG_CLASSES: Record<string, string> = {
  none: 'lg:px-0',
  sm: 'lg:px-2',
  md: 'lg:px-4',
  lg: 'lg:px-6',
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

const PARAGRAPH_FONT_SIZE_CLASSES: Record<string, string> = {
  px_28: 'prose-p-size-28',
  px_22: 'prose-p-size-22',
  px_18: 'prose-p-size-18',
  px_16: 'prose-p-size-16',
  px_14: 'prose-p-size-14',
  px_12: 'prose-p-size-12',
}

const PARAGRAPH_FONT_WEIGHT_CLASSES: Record<string, string> = {
  medium: 'prose-p-weight-medium',
  bold: 'prose-p-weight-bold',
}

function wrapTables(html: string): string {
  return html.replace(
    /(<table[\s\S]*?<\/table>)/gi,
    '<div style="overflow-x:auto">$1</div>'
  )
}

export default function TextContentElement({
  MainBody,
  displaySettings,
}: TextContentElementProps) {
  const {
    colorScheme,
    textStroke,
    paddingX,
    paddingXMd,
    paddingXLg,
    paddingTop,
    paddingTopLg,
    paddingRight,
    paddingRightLg,
    paddingBottom,
    paddingBottomLg,
    paddingLeft,
    paddingLeftLg,
    paragraphFontSize,
    paragraphFontWeight,
  } = displaySettings ?? {}
  const html = MainBody?.html ? wrapTables(MainBody.html) : MainBody?.html

  const colorKey = (colorScheme as keyof typeof COLOR_CLASSES) || 'default'
  const strokeEnabled = parseBoolean(textStroke)
  const strokeClass = strokeEnabled
    ? colorKey === 'lfgreen'
      ? 'text-stroke-lfgreen'
      : 'text-stroke-darkfir'
    : undefined

  const fontSizeClass =
    paragraphFontSize && paragraphFontSize !== 'default'
      ? PARAGRAPH_FONT_SIZE_CLASSES[paragraphFontSize]
      : undefined
  const fontWeightClass =
    paragraphFontWeight && paragraphFontWeight !== 'default'
      ? PARAGRAPH_FONT_WEIGHT_CLASSES[paragraphFontWeight]
      : undefined

  return (
    <div
      className={cn(
        'element text-content-element',
        paddingX && PADDING_X_CLASSES[paddingX],
        paddingXMd &&
          paddingXMd !== 'inherit' &&
          PADDING_X_MD_CLASSES[paddingXMd],
        paddingXLg &&
          paddingXLg !== 'inherit' &&
          PADDING_X_LG_CLASSES[paddingXLg],
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
      )}
    >
      <EditableHtml
        field="MainBody"
        html={html}
        className={cn(
          'prose prose-rte max-w-none',
          COLOR_CLASSES[colorKey],
          strokeClass,
          fontSizeClass,
          fontWeightClass
        )}
      />
    </div>
  )
}
