import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const sliderVariants = cva(
  'relative flex w-full touch-none select-none items-center',
  {
    variants: {
      variant: {
        default: '',
        destructive: '',
        success: '',
      },
      size: {
        default: '',
        sm: '',
        lg: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

const sliderTrackVariants = cva(
  'relative h-2 w-full grow overflow-hidden rounded-full bg-gray-200',
  {
    variants: {
      size: {
        default: 'h-2',
        sm: 'h-1',
        lg: 'h-3',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
)

const sliderRangeVariants = cva('absolute h-full', {
  variants: {
    variant: {
      default: 'bg-blue-600',
      destructive: 'bg-red-600',
      success: 'bg-green-600',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

const sliderThumbVariants = cva(
  'block rounded-full border-2 border-white bg-white ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-blue-600 shadow-md',
        destructive: 'border-red-600 shadow-md',
        success: 'border-green-600 shadow-md',
      },
      size: {
        default: 'size-5',
        sm: 'size-4',
        lg: 'size-6',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface SliderProps
  extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>,
    VariantProps<typeof sliderVariants> {}

const Slider = React.forwardRef<
  React.ComponentRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, variant, size, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(sliderVariants({ variant, size, className }))}
    {...props}
  >
    <SliderPrimitive.Track className={cn(sliderTrackVariants({ size }))}>
      <SliderPrimitive.Range className={cn(sliderRangeVariants({ variant }))} />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className={cn(sliderThumbVariants({ variant, size }))}
    />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider, sliderVariants }
