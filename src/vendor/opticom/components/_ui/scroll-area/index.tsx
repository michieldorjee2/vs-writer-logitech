import * as React from 'react'
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const scrollAreaVariants = cva('relative overflow-hidden', {
  variants: {
    type: {
      auto: '',
      always: '',
      scroll: '',
      hover: '',
    },
  },
  defaultVariants: {
    type: 'hover',
  },
})

interface ScrollAreaProps
  extends Omit<
      React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>,
      'type'
    >,
    VariantProps<typeof scrollAreaVariants> {}

type ScrollAreaViewportProps = React.ComponentPropsWithoutRef<
  typeof ScrollAreaPrimitive.Viewport
>

type ScrollAreaScrollbarProps = React.ComponentPropsWithoutRef<
  typeof ScrollAreaPrimitive.Scrollbar
>

type ScrollAreaThumbProps = React.ComponentPropsWithoutRef<
  typeof ScrollAreaPrimitive.Thumb
>

type ScrollAreaCornerProps = React.ComponentPropsWithoutRef<
  typeof ScrollAreaPrimitive.Corner
>

const ScrollArea = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitive.Root>,
  ScrollAreaProps
>(({ className, type, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn(scrollAreaVariants({ type, className }))}
    type={type || undefined}
    {...props}
  >
    <ScrollAreaViewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaViewport>
    <ScrollAreaScrollbar />
    <ScrollAreaCorner />
  </ScrollAreaPrimitive.Root>
))
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollAreaViewport = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitive.Viewport>,
  ScrollAreaViewportProps
>(({ className, ...props }, ref) => (
  <ScrollAreaPrimitive.Viewport
    ref={ref}
    className={cn('h-full w-full rounded-[inherit]', className)}
    {...props}
  />
))
ScrollAreaViewport.displayName = ScrollAreaPrimitive.Viewport.displayName

const ScrollAreaScrollbar = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitive.Scrollbar>,
  ScrollAreaScrollbarProps
>(({ className, orientation = 'vertical', ...props }, ref) => (
  <ScrollAreaPrimitive.Scrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      'flex touch-none transition-colors select-none',
      orientation === 'vertical' &&
        'h-full w-2.5 border-l border-l-transparent p-px',
      orientation === 'horizontal' &&
        'h-2.5 flex-col border-t border-t-transparent p-px',
      className
    )}
    {...props}
  >
    <ScrollAreaThumb />
  </ScrollAreaPrimitive.Scrollbar>
))
ScrollAreaScrollbar.displayName = ScrollAreaPrimitive.Scrollbar.displayName

const ScrollAreaThumb = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitive.Thumb>,
  ScrollAreaThumbProps
>(({ className, ...props }, ref) => (
  <ScrollAreaPrimitive.Thumb
    ref={ref}
    className={cn('bg-border relative flex-1 rounded-full', className)}
    {...props}
  />
))
ScrollAreaThumb.displayName = ScrollAreaPrimitive.Thumb.displayName

const ScrollAreaCorner = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitive.Corner>,
  ScrollAreaCornerProps
>(({ className, ...props }, ref) => (
  <ScrollAreaPrimitive.Corner
    ref={ref}
    className={cn('bg-blackA6', className)}
    {...props}
  />
))
ScrollAreaCorner.displayName = ScrollAreaPrimitive.Corner.displayName

export {
  ScrollArea,
  ScrollAreaViewport,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaCorner,
  scrollAreaVariants,
}
