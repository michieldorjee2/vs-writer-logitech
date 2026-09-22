import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const tabsVariants = cva('w-full', {
  variants: {
    orientation: {
      horizontal: '',
      vertical: 'flex gap-4',
    },
  },
  defaultVariants: {
    orientation: 'horizontal',
  },
})

const tabsListVariants = cva(
  'inline-flex items-center justify-center rounded-md p-1 text-gray-500',
  {
    variants: {
      variant: {
        default: 'bg-gray-100',
        line: 'bg-transparent border-b border-gray-200',
        pill: 'bg-gray-100',
      },
      orientation: {
        horizontal: 'h-10 w-full',
        vertical: 'flex-col h-auto w-48',
      },
    },
    defaultVariants: {
      variant: 'default',
      orientation: 'horizontal',
    },
  }
)

const tabsTriggerVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'data-[state=active]:bg-white data-[state=active]:text-gray-950 data-[state=active]:shadow-sm',
        line: 'rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent',
        pill: 'data-[state=active]:bg-blue-600 data-[state=active]:text-white',
      },
      orientation: {
        horizontal: '',
        vertical: 'w-full justify-start',
      },
    },
    defaultVariants: {
      variant: 'default',
      orientation: 'horizontal',
    },
  }
)

const tabsContentVariants = cva(
  'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  {
    variants: {
      orientation: {
        horizontal: '',
        vertical: 'flex-1',
      },
    },
    defaultVariants: {
      orientation: 'horizontal',
    },
  }
)

interface TabsProps
  extends Omit<
      React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>,
      'orientation'
    >,
    VariantProps<typeof tabsVariants> {}

interface TabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>,
    VariantProps<typeof tabsListVariants> {}

interface TabsTriggerProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>,
    VariantProps<typeof tabsTriggerVariants> {}

interface TabsContentProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>,
    VariantProps<typeof tabsContentVariants> {}

const Tabs = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Root>,
  TabsProps
>(({ className, orientation, ...props }, ref) => (
  <TabsPrimitive.Root
    ref={ref}
    orientation={orientation || undefined}
    className={cn(tabsVariants({ orientation, className }))}
    {...props}
  />
))
Tabs.displayName = TabsPrimitive.Root.displayName

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, variant, orientation, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(tabsListVariants({ variant, orientation, className }))}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, variant, orientation, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(tabsTriggerVariants({ variant, orientation, className }))}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  TabsContentProps
>(({ className, orientation, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(tabsContentVariants({ orientation, className }))}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsVariants }
