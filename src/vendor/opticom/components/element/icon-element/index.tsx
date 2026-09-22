import { parseDisplaySettings } from '@/lib/hooks/parseDisplaySettings'
import { EditableField } from '@/lib/optimizely/features/draft/editable-field'
import type {
  MaterialIconProps,
  ExtendedIconElementProps,
  DisplaySettingValues,
} from './types'

const SIZE_MAP: Record<string, string> = {
  small: '24',
  medium: '36',
  large: '48',
}

const WEIGHT_MAP: Record<string, string> = {
  light: '300',
  regular: '400',
  bold: '700',
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
}

export function MaterialIcon({
  name,
  size = '24',
  weight = '400',
  fill = '0',
  color = 'inherit',
  className,
  altText,
}: MaterialIconProps) {
  const sizeNum = parseInt(size, 10)

  const style: React.CSSProperties = {
    fontSize: `${sizeNum}px`,
    fontVariationSettings: `'FILL' ${fill}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${sizeNum}`,
    color: color !== 'inherit' ? color : undefined,
  }

  return (
    <span
      className={`material-symbols-rounded${className ? ` ${className}` : ''}`}
      style={style}
      role={altText ? 'img' : undefined}
      aria-label={altText || undefined}
      aria-hidden={!altText ? true : undefined}
    >
      {name}
    </span>
  )
}

export default function IconElement({
  Icon,
  AltText,
  displaySettings,
}: ExtendedIconElementProps) {
  const { size, weight, fill, color } =
    parseDisplaySettings<DisplaySettingValues>(displaySettings)

  if (!Icon) return null

  return (
    <EditableField field="Icon">
      <MaterialIcon
        name={Icon}
        size={SIZE_MAP[(size as string) ?? ''] ?? '24'}
        weight={WEIGHT_MAP[(weight as string) ?? ''] ?? '400'}
        fill={FILL_MAP[(fill as string) ?? ''] ?? '0'}
        color={COLOR_MAP[(color as string) ?? ''] ?? 'inherit'}
        altText={AltText ?? undefined}
      />
    </EditableField>
  )
}

export type {
  MaterialIconProps,
  ExtendedIconElementProps,
  DisplaySettingValues,
} from './types'
