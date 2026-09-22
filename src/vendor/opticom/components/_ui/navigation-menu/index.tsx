import * as React from 'react'
import * as NavigationMenuPrimitive from '@radix-ui/react-navigation-menu'
import { cva, type VariantProps } from 'class-variance-authority'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

const navigationMenuVariants = cva(
  'relative z-10 flex max-w-max flex-1 items-center justify-center',
  {
    variants: {
      orientation: {
        horizontal: '',
        vertical: 'flex-col items-start',
      },
    },
    defaultVariants: {
      orientation: 'horizontal',
    },
  }
)

const navigationMenuListVariants = cva(
  'group flex flex-1 list-none items-center justify-center space-x-1',
  {
    variants: {
      orientation: {
        horizontal: 'flex-row space-x-1 space-y-0',
        vertical: 'flex-col space-x-0 space-y-1',
      },
    },
    defaultVariants: {
      orientation: 'horizontal',
    },
  }
)

const navigationMenuTriggerVariants = cva(
  'group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50',
  {
    variants: {
      variant: {
        default: '',
        ghost: 'hover:bg-transparent hover:underline',
        underline:
          'rounded-none border-b-2 border-transparent hover:border-foreground data-[active]:border-foreground data-[state=open]:border-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

const navigationMenuContentVariants = cva(
  'left-0 top-0 w-full data-[motion^=from-]:animate-in data-[motion^=to-]:animate-out data-[motion^=from-]:fade-in data-[motion^=to-]:fade-out data-[motion=from-end]:slide-in-from-right-52 data-[motion=from-start]:slide-in-from-left-52 data-[motion=to-end]:slide-out-to-right-52 data-[motion=to-start]:slide-out-to-left-52 md:absolute md:w-auto',
  {
    variants: {
      variant: {
        default: '',
        card: 'bg-popover text-popover-foreground border rounded-md shadow-md',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

interface NavigationMenuProps
  extends Omit<
      React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Root>,
      'orientation'
    >,
    VariantProps<typeof navigationMenuVariants> {}

interface NavigationMenuListProps
  extends Omit<
      React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.List>,
      'orientation'
    >,
    VariantProps<typeof navigationMenuListVariants> {}

interface NavigationMenuTriggerProps
  extends React.ComponentPropsWithoutRef<
      typeof NavigationMenuPrimitive.Trigger
    >,
    VariantProps<typeof navigationMenuTriggerVariants> {}

interface NavigationMenuContentProps
  extends React.ComponentPropsWithoutRef<
      typeof NavigationMenuPrimitive.Content
    >,
    VariantProps<typeof navigationMenuContentVariants> {}

type NavigationMenuItemProps = React.ComponentPropsWithoutRef<
  typeof NavigationMenuPrimitive.Item
>

type NavigationMenuLinkProps = React.ComponentPropsWithoutRef<
  typeof NavigationMenuPrimitive.Link
>

type NavigationMenuIndicatorProps = React.ComponentPropsWithoutRef<
  typeof NavigationMenuPrimitive.Indicator
>

type NavigationMenuViewportProps = React.ComponentPropsWithoutRef<
  typeof NavigationMenuPrimitive.Viewport
>

const NavigationMenu = React.forwardRef<
  React.ComponentRef<typeof NavigationMenuPrimitive.Root>,
  NavigationMenuProps
>(({ className, orientation, children, ...props }, ref) => (
  <NavigationMenuPrimitive.Root
    ref={ref}
    className={cn(navigationMenuVariants({ orientation, className }))}
    {...props}
  >
    {children}
    <NavigationMenuViewport />
  </NavigationMenuPrimitive.Root>
))
NavigationMenu.displayName = NavigationMenuPrimitive.Root.displayName

const NavigationMenuList = React.forwardRef<
  React.ComponentRef<typeof NavigationMenuPrimitive.List>,
  NavigationMenuListProps
>(({ className, orientation, ...props }, ref) => (
  <NavigationMenuPrimitive.List
    ref={ref}
    className={cn(navigationMenuListVariants({ orientation, className }))}
    {...props}
  />
))
NavigationMenuList.displayName = NavigationMenuPrimitive.List.displayName

const NavigationMenuItem = React.forwardRef<
  React.ComponentRef<typeof NavigationMenuPrimitive.Item>,
  NavigationMenuItemProps
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Item ref={ref} className={className} {...props} />
))
NavigationMenuItem.displayName = NavigationMenuPrimitive.Item.displayName

const NavigationMenuTrigger = React.forwardRef<
  React.ComponentRef<typeof NavigationMenuPrimitive.Trigger>,
  NavigationMenuTriggerProps
>(({ className, variant, children, ...props }, ref) => (
  <NavigationMenuPrimitive.Trigger
    ref={ref}
    className={cn(
      navigationMenuTriggerVariants({ variant, className }),
      'group'
    )}
    {...props}
  >
    {children}{' '}
    <ChevronDown
      className="relative top-px ml-1 size-3 transition duration-200 group-data-[state=open]:rotate-180"
      aria-hidden="true"
    />
  </NavigationMenuPrimitive.Trigger>
))
NavigationMenuTrigger.displayName = NavigationMenuPrimitive.Trigger.displayName

const NavigationMenuContent = React.forwardRef<
  React.ComponentRef<typeof NavigationMenuPrimitive.Content>,
  NavigationMenuContentProps
>(({ className, variant, ...props }, ref) => (
  <NavigationMenuPrimitive.Content
    ref={ref}
    className={cn(navigationMenuContentVariants({ variant, className }))}
    {...props}
  />
))
NavigationMenuContent.displayName = NavigationMenuPrimitive.Content.displayName

const NavigationMenuLink = React.forwardRef<
  React.ComponentRef<typeof NavigationMenuPrimitive.Link>,
  NavigationMenuLinkProps
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Link
    ref={ref}
    className={cn(
      'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground block space-y-1 rounded-md p-3 leading-none no-underline transition-colors outline-none select-none',
      className
    )}
    {...props}
  />
))
NavigationMenuLink.displayName = NavigationMenuPrimitive.Link.displayName

const NavigationMenuIndicator = React.forwardRef<
  React.ComponentRef<typeof NavigationMenuPrimitive.Indicator>,
  NavigationMenuIndicatorProps
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Indicator
    ref={ref}
    className={cn(
      'data-[state=visible]:animate-in data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:fade-in top-full z-1 flex h-1.5 items-end justify-center overflow-hidden',
      className
    )}
    {...props}
  >
    <div className="bg-border relative top-[60%] size-2 rotate-45 rounded-tl-sm shadow-md" />
  </NavigationMenuPrimitive.Indicator>
))
NavigationMenuIndicator.displayName =
  NavigationMenuPrimitive.Indicator.displayName

const NavigationMenuViewport = React.forwardRef<
  React.ComponentRef<typeof NavigationMenuPrimitive.Viewport>,
  NavigationMenuViewportProps
>(({ className, ...props }, ref) => (
  <div className={cn('absolute top-full left-0 flex justify-center')}>
    <NavigationMenuPrimitive.Viewport
      className={cn(
        'origin-top-center bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-90 relative mt-1.5 h-(--radix-navigation-menu-viewport-height) w-full overflow-hidden rounded-md border shadow-lg md:w-(--radix-navigation-menu-viewport-width)',
        className
      )}
      ref={ref}
      {...props}
    />
  </div>
))
NavigationMenuViewport.displayName =
  NavigationMenuPrimitive.Viewport.displayName

export {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
  NavigationMenuIndicator,
  NavigationMenuViewport,
  navigationMenuVariants,
}
