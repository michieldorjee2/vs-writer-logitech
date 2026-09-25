import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-3 font-button font-(--font-weight-button) leading-[1.3] text-center transition-all cursor-pointer border-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-ltblue disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: [
          'border border-lfgreen-100 bg-primary-lfgreen text-secondary-darkfir',
          'hover:translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[-2px_2px_0_0_var(--color-lfgreen-100)]',
          'active:translate-x-0 active:translate-y-0 active:shadow-none active:bg-lfgreen-100',
        ],
        dark: [
          'border border-secondary-darkfir bg-tertiary-midfir text-tertiary-2',
          'hover:translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[-2px_2px_0_0_var(--color-secondary-darkfir)]',
          'active:translate-x-0 active:translate-y-0 active:shadow-none active:bg-secondary-darkfir',
        ],
        white: [
          'border border-tertiary-2 bg-primary-1 text-secondary-darkfir',
          'hover:translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[-2px_2px_0_0_var(--color-tertiary-2)]',
          'active:translate-x-0 active:translate-y-0 active:shadow-none active:bg-tertiary-2',
        ],
        neutral: [
          'border border-primary-3 bg-tertiary-2 text-secondary-darkfir',
          'hover:translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[-2px_2px_0_0_var(--color-primary-3)]',
          'active:translate-x-0 active:translate-y-0 active:shadow-none active:bg-primary-3',
        ],
        whiteStroke: [
          'border-0 bg-transparent text-tertiary-2',
          'group-hover/stroke:translate-x-0.5 group-hover/stroke:-translate-y-0.5',
          'group-active/stroke:translate-x-0 group-active/stroke:translate-y-0',
        ],
        opalStroke: [
          'border-0 bg-transparent text-tertiary-2',
          'group-hover/stroke:translate-x-0.5 group-hover/stroke:-translate-y-0.5',
          'group-active/stroke:translate-x-0 group-active/stroke:translate-y-0',
        ],
        darkStroke: [
          'border-0 bg-transparent text-secondary-darkfir',
          'group-hover/stroke:translate-x-0.5 group-hover/stroke:-translate-y-0.5',
          'group-active/stroke:translate-x-0 group-active/stroke:translate-y-0',
        ],
        link: 'border-0 bg-transparent text-secondary-darkfir underline-offset-4 hover:underline p-0 rounded-none',
      },
      size: {
        sm: 'h-10 rounded-(--radius-cta-sml) px-4 text-(length:--text-body-xs) tracking-[0.32px]',
        default:
          'h-10 rounded-(--radius-cta-sml) px-4 text-(length:--text-body-xs) leading-[1.3] tracking-[0.32px] min-[1024px]:h-14 min-[1024px]:rounded-[20px] min-[1024px]:px-6 min-[1024px]:text-body-med min-[1024px]:tracking-[0.4px]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
)

const groupHoverByVariant: Record<string, string> = {
  primary: [
    'group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:shadow-[-2px_2px_0_0_var(--color-lfgreen-100)]',
    'group-focus-visible:translate-x-0.5 group-focus-visible:-translate-y-0.5 group-focus-visible:shadow-[-2px_2px_0_0_var(--color-lfgreen-100)]',
    'group-active:translate-x-0 group-active:translate-y-0 group-active:shadow-none group-active:bg-lfgreen-100',
  ].join(' '),
  dark: [
    'group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:shadow-[-2px_2px_0_0_var(--color-secondary-darkfir)]',
    'group-focus-visible:translate-x-0.5 group-focus-visible:-translate-y-0.5 group-focus-visible:shadow-[-2px_2px_0_0_var(--color-secondary-darkfir)]',
    'group-active:translate-x-0 group-active:translate-y-0 group-active:shadow-none group-active:bg-secondary-darkfir',
  ].join(' '),
  white: [
    'group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:shadow-[-2px_2px_0_0_var(--color-tertiary-2)]',
    'group-focus-visible:translate-x-0.5 group-focus-visible:-translate-y-0.5 group-focus-visible:shadow-[-2px_2px_0_0_var(--color-tertiary-2)]',
    'group-active:translate-x-0 group-active:translate-y-0 group-active:shadow-none group-active:bg-tertiary-2',
  ].join(' '),
  neutral: [
    'group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:shadow-[-2px_2px_0_0_var(--color-primary-3)]',
    'group-focus-visible:translate-x-0.5 group-focus-visible:-translate-y-0.5 group-focus-visible:shadow-[-2px_2px_0_0_var(--color-primary-3)]',
    'group-active:translate-x-0 group-active:translate-y-0 group-active:shadow-none group-active:bg-primary-3',
  ].join(' '),
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  groupHover?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, groupHover, ...props },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, className }),
          groupHover && groupHoverByVariant[variant ?? 'primary']
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
