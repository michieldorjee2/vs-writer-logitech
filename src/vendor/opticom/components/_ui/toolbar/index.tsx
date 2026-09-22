import * as React from 'react'
import * as ToolbarPrimitive from '@radix-ui/react-toolbar'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/*
 * PATCH (rem-scale-mismatch, see src/vendor/opticom/UPSTREAM.md): upstream spells this
 * utility as an arbitrary bracketed value of 2.5 rem, which is invisible to this app's
 * root-font-size rescale (tailwind.config.js's rem-scale-mismatch comment) and would render
 * at 25px here instead of the 40px that value means at a standard 16px root. `min-h-10` is
 * Tailwind's own non-arbitrary scale step for 2.5rem and reads from the same rescaled theme
 * every other themed utility in this file does.
 */
const toolbarVariants = cva(
  'flex min-h-10 w-full items-center gap-1 rounded-md border bg-background p-1',
  {
    variants: {
      orientation: {
        horizontal: 'flex-row',
        vertical: 'flex-col h-auto w-auto',
      },
    },
    defaultVariants: {
      orientation: 'horizontal',
    },
  }
)

const toolbarSeparatorVariants = cva('bg-border', {
  variants: {
    orientation: {
      horizontal: 'w-px h-full',
      vertical: 'h-px w-full',
    },
  },
  defaultVariants: {
    orientation: 'horizontal',
  },
})

const toolbarButtonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-transparent hover:bg-accent hover:text-accent-foreground data-[state=on]:bg-accent data-[state=on]:text-accent-foreground',
        outline:
          'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-9 px-2.5',
        sm: 'h-8 px-2',
        lg: 'h-10 px-3',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

interface ToolbarProps
  extends Omit<
      React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Root>,
      'orientation'
    >,
    VariantProps<typeof toolbarVariants> {}

interface ToolbarButtonProps
  extends React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Button>,
    VariantProps<typeof toolbarButtonVariants> {}

interface ToolbarToggleItemProps
  extends React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.ToggleItem>,
    VariantProps<typeof toolbarButtonVariants> {
  className?: string
}

interface ToolbarSeparatorProps
  extends Omit<
      React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Separator>,
      'orientation'
    >,
    VariantProps<typeof toolbarSeparatorVariants> {}

type ToolbarLinkProps = React.ComponentPropsWithoutRef<
  typeof ToolbarPrimitive.Link
>

const Toolbar = React.forwardRef<
  React.ComponentRef<typeof ToolbarPrimitive.Root>,
  ToolbarProps
>(({ className, orientation, ...props }, ref) => (
  <ToolbarPrimitive.Root
    ref={ref}
    className={cn(toolbarVariants({ orientation, className }))}
    {...props}
  />
))
Toolbar.displayName = ToolbarPrimitive.Root.displayName

const ToolbarButton = React.forwardRef<
  React.ComponentRef<typeof ToolbarPrimitive.Button>,
  ToolbarButtonProps
>(({ className, variant, size, ...props }, ref) => (
  <ToolbarPrimitive.Button
    ref={ref}
    className={cn(toolbarButtonVariants({ variant, size, className }))}
    {...props}
  />
))
ToolbarButton.displayName = ToolbarPrimitive.Button.displayName

const ToolbarSeparator = React.forwardRef<
  React.ComponentRef<typeof ToolbarPrimitive.Separator>,
  ToolbarSeparatorProps
>(({ className, orientation, ...props }, ref) => (
  <ToolbarPrimitive.Separator
    ref={ref}
    className={cn(toolbarSeparatorVariants({ orientation, className }))}
    {...props}
  />
))
ToolbarSeparator.displayName = ToolbarPrimitive.Separator.displayName

const ToolbarLink = React.forwardRef<
  React.ComponentRef<typeof ToolbarPrimitive.Link>,
  ToolbarLinkProps
>(({ className, ...props }, ref) => (
  <ToolbarPrimitive.Link
    ref={ref}
    className={cn(
      'ring-offset-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex items-center justify-center rounded-sm bg-transparent px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
      className
    )}
    {...props}
  />
))
ToolbarLink.displayName = ToolbarPrimitive.Link.displayName

const ToolbarToggleGroup = ToolbarPrimitive.ToggleGroup

const ToolbarToggleItem = React.forwardRef<
  React.ComponentRef<typeof ToolbarPrimitive.ToggleItem>,
  ToolbarToggleItemProps
>(({ className, variant, size, ...props }, ref) => (
  <ToolbarPrimitive.ToggleItem
    ref={ref}
    className={cn(toolbarButtonVariants({ variant, size, className }))}
    {...props}
  />
))
ToolbarToggleItem.displayName = ToolbarPrimitive.ToggleItem.displayName

export {
  Toolbar,
  ToolbarButton,
  ToolbarSeparator,
  ToolbarLink,
  ToolbarToggleGroup,
  ToolbarToggleItem,
  toolbarVariants,
}
