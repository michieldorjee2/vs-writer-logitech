import * as React from 'react'
import * as SeparatorPrimitive from '@radix-ui/react-separator'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const separatorVariants = cva('shrink-0 bg-border', {
  variants: {
    orientation: {
      horizontal: 'h-px w-full',
      vertical: 'h-full w-px',
    },
    decorative: {
      true: '',
      false: '',
    },
  },
  defaultVariants: {
    orientation: 'horizontal',
    decorative: true,
  },
})

interface SeparatorProps
  extends Omit<
      React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>,
      'orientation' | 'decorative'
    >,
    VariantProps<typeof separatorVariants> {}

const Separator = React.forwardRef<
  React.ComponentRef<typeof SeparatorPrimitive.Root>,
  SeparatorProps
>(
  (
    { className, orientation = 'horizontal', decorative = true, ...props },
    ref
  ) => (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative || undefined}
      orientation={orientation || undefined}
      className={cn(separatorVariants({ orientation, decorative, className }))}
      {...props}
    />
  )
)
Separator.displayName = SeparatorPrimitive.Root.displayName

export { Separator, separatorVariants }
