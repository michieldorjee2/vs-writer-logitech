import { cn } from '../../../lib/utils'
import { EditableField } from '../../../lib/optimizely/features/draft/editable-field'
import { readFragment } from '../../../lib/optimizely/graphql'
import { displaySettingsToObject } from '../../../lib/optimizely/types/display-settings'
import {
  IconElementFragment,
  type IconElementProps,
  type MaterialIconProps,
  type IconElementDisplaySettings,
} from './types'

export {
  IconElementFragment,
  type IconElementProps,
  type IconElementDisplaySettings,
  type MaterialIconProps,
}

const ICON_SIZE_NO_BG: Record<string, string> = {
  xs: '16',
  sm: '20',
  med: '24',
  lrg: '30',
  xl: '40',
}

const ICON_SIZE_WITH_BG: Record<string, string> = {
  xs: '12',
  sm: '16',
  med: '20',
  lrg: '30',
  xl: '40',
}

const CONTAINER_SIZE: Record<string, string> = {
  xs: 'size-[18px]',
  sm: 'size-6',
  med: 'size-[30px]',
  lrg: 'size-10',
  xl: 'size-[50px]',
}

const CONTAINER_RADIUS: Record<string, string> = {
  xs: 'rounded-(--radius-icon-xxs)',
  sm: 'rounded-(--radius-icon-sm)',
  med: 'rounded-(--radius-icon-med)',
  lrg: 'rounded-(--radius-icon-med)',
  xl: 'rounded-(--radius-icon-lrg)',
}

const FILL_MAP: Record<string, string> = {
  outlined: '0',
  filled: '1',
}

const COLOR_MAP: Record<string, string> = {
  darkfir: 'var(--color-fir-darkfir)',
  white: 'var(--color-neutral-1)',
  green: 'var(--color-primary-goodtogo)',
  ltblue: 'var(--color-secondary-ltblue)',
  pink: 'var(--color-tertiary-darkpink)',
  neutral: 'var(--color-tertiary-2)',
}

const BG_CLASSES: Record<string, string> = {
  lfgreen: 'bg-(--color-primary-lfgreen) border-lfgreen-100',
  ltblue: 'bg-(--color-secondary-ltblue) border-(--color-secondary-ltblue)/60',
  darkfir:
    'bg-(--color-secondary-darkfir) border-(--color-secondary-darkfir)/60',
  white: 'bg-white border-(--color-tertiary-5)',
  pink: 'bg-(--color-tertiary-darkpink) border-(--color-tertiary-darkpink)/60',
  opal: 'bg-(--color-tertiary-opal) border-(--color-tertiary-opal)/60',
  mid_green: 'bg-(--color-green-grass) border-(--color-green-grass)/60',
  mid_dark_green: 'bg-(--color-fir-midfir) border-(--color-fir-midfir)/60',
  light_dark_green:
    'bg-(--color-fir-lightfir) border-(--color-fir-lightfir)/60',
  light_pink: 'bg-(--color-pink-ltpink) border-(--color-pink-ltpink)/60',
  mid_neutral: 'bg-(--color-neutral-4) border-(--color-neutral-4)/60',
}

const DARK_BG_KEYS = new Set(['darkfir', 'pink', 'mid_dark_green'])

export function MaterialIcon({
  name,
  size = '24',
  weight = '300',
  fill = '1',
  grade = '200',
  color = 'inherit',
  className,
  altText,
}: MaterialIconProps) {
  const sizeNum = parseInt(size, 10)

  const style: React.CSSProperties = {
    fontSize: `${sizeNum}px`,
    fontVariationSettings: `'FILL' ${fill}, 'wght' ${weight}, 'GRAD' ${grade}, 'opsz' ${sizeNum}`,
    color: color !== 'inherit' ? color : undefined,
  }

  return (
    <span
      className={`material-symbols-rounded select-none${className ? ` ${className}` : ''}`}
      style={style}
      role={altText ? 'img' : undefined}
      aria-label={altText || undefined}
      aria-hidden={!altText ? true : undefined}
    >
      {name}
    </span>
  )
}

export default function IconElement(props: IconElementProps) {
  const { Icon, AltText } = readFragment(IconElementFragment, props)
  const { displaySettings } = props
  const { size, fill, color, background } = Array.isArray(displaySettings)
    ? displaySettingsToObject<IconElementDisplaySettings>(displaySettings)
    : (displaySettings ?? {})

  if (!Icon) return null

  const sizeKey = (size as string) ?? 'med'
  const bgKey = (background as string) ?? 'none'
  const bgClass = BG_CLASSES[bgKey]
  const hasBg = !!bgClass

  const colorKey = (color as string) ?? 'inherit'
  const resolvedColor =
    colorKey === 'inherit' && hasBg && DARK_BG_KEYS.has(bgKey)
      ? COLOR_MAP.white
      : (COLOR_MAP[colorKey] ?? 'inherit')

  const iconPx = hasBg
    ? (ICON_SIZE_WITH_BG[sizeKey] ?? '20')
    : (ICON_SIZE_NO_BG[sizeKey] ?? '24')

  const icon = (
    <MaterialIcon
      name={Icon}
      size={iconPx}
      fill={FILL_MAP[(fill as string) ?? ''] ?? '1'}
      color={resolvedColor}
      altText={AltText ?? undefined}
    />
  )

  if (hasBg) {
    return (
      <EditableField field="Icon">
        <div
          className={cn(
            'inline-flex items-center justify-center border',
            CONTAINER_SIZE[sizeKey] ?? 'size-[30px]',
            CONTAINER_RADIUS[sizeKey] ?? 'rounded-lg',
            bgClass
          )}
        >
          {icon}
        </div>
      </EditableField>
    )
  }

  return (
    <EditableField field="Icon">
      <span className="inline-flex">{icon}</span>
    </EditableField>
  )
}
