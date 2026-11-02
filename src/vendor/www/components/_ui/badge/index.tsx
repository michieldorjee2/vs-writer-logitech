import { cva, type VariantProps } from 'class-variance-authority'
import { MaterialIcon } from '../../element/icon-element'
import { cn } from '../../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center border font-overline leading-[1.2] uppercase [text-box:trim-both_cap_alphabetic]',
  {
    variants: {
      color: {
        lfgreen: '',
        darkgreen: '',
        neutral: '',
      },
      filled: {
        true: '',
        false: '',
      },
      size: {
        sm: 'rounded-(--radius-icon-sm) text-body-4xs tracking-[0.3px]',
        md: 'rounded-(--radius-icon-med) text-(length:--text-body-xxs) tracking-[0.42px]',
        lg: 'rounded-(--radius-icon-med) text-(length:--text-overline-base) tracking-[0.48px]',
      },
      icon: {
        true: '',
        false: '',
      },
      iconBackground: {
        true: '',
        false: '',
      },
    },
    compoundVariants: [
      {
        color: 'lfgreen',
        filled: true,
        class:
          'bg-primary-lfgreen border-secondary-darkfir text-secondary-darkfir',
      },
      {
        color: 'darkgreen',
        filled: false,
        class: 'border-secondary-darkfir text-secondary-darkfir',
      },
      {
        color: 'neutral',
        filled: false,
        class: 'border-tertiary-2 text-tertiary-2',
      },

      { size: 'sm', icon: false, class: 'h-[30px] gap-2 px-2.5' },
      { size: 'md', icon: false, class: 'gap-2 p-3' },
      { size: 'lg', icon: false, class: 'h-[38px] gap-2 px-3' },

      {
        size: 'sm',
        icon: true,
        iconBackground: true,
        class: 'h-[30px] gap-1 pl-1 pr-2.5',
      },
      {
        size: 'md',
        icon: true,
        iconBackground: true,
        class: 'h-9 gap-2 pl-1 pr-3',
      },
      {
        size: 'lg',
        icon: true,
        iconBackground: true,
        class: 'h-9 gap-2 pl-1 pr-3',
      },

      {
        size: 'sm',
        icon: true,
        iconBackground: false,
        class: 'h-[30px] gap-1.5 pl-2 pr-2.5',
      },
      {
        size: 'md',
        icon: true,
        iconBackground: false,
        class: 'h-9 gap-2 pl-2 pr-3',
      },
      {
        size: 'lg',
        icon: true,
        iconBackground: false,
        class: 'h-[38px] gap-2 pl-2 pr-3',
      },
    ],
    defaultVariants: {
      color: 'lfgreen',
      filled: true,
      size: 'lg',
      icon: false,
      iconBackground: false,
    },
  }
)

export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  label: string
  iconName?: string
  className?: string
}

export function Badge({
  label,
  iconName,
  color = 'lfgreen',
  filled = true,
  size = 'lg',
  iconBackground = false,
  className,
}: BadgeProps) {
  const hasIcon = !!iconName

  const iconSize = size === 'sm' ? '14' : size === 'md' ? '18' : '20'

  const iconColor = iconBackground
    ? 'var(--color-secondary-darkfir)'
    : color === 'neutral'
      ? 'var(--color-tertiary-2)'
      : 'var(--color-secondary-darkfir)'

  const iconBoxSize =
    size === 'sm' ? 'size-5' : size === 'md' ? 'size-[26px]' : 'size-[30px]'

  const iconBoxRadius =
    size === 'sm' ? 'rounded-(--radius-icon-xs)' : 'rounded-(--radius-icon-sm)'

  return (
    <span
      className={cn(
        badgeVariants({
          color,
          filled,
          size,
          icon: hasIcon,
          iconBackground: hasIcon ? iconBackground : false,
        }),
        className
      )}
    >
      {hasIcon &&
        (iconBackground ? (
          <span
            className={cn(
              'inline-flex items-center justify-center bg-(--color-secondary-ltblue)',
              iconBoxSize,
              iconBoxRadius
            )}
          >
            <MaterialIcon
              name={iconName}
              size={iconSize}
              fill="1"
              color={iconColor}
            />
          </span>
        ) : (
          <MaterialIcon
            name={iconName}
            size={iconSize}
            fill="1"
            color={iconColor}
          />
        ))}
      {label}
    </span>
  )
}

export { badgeVariants }
