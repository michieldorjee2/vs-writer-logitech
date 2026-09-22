import * as React from 'react'
import * as MenubarPrimitive from '@radix-ui/react-menubar'
import { Check, ChevronRight, Circle } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const menubarVariants = cva(
  'flex h-10 items-center space-x-1 rounded-md border bg-background p-1',
  {
    variants: {
      variant: {
        default: '',
        ghost: 'border-transparent bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

const menubarTriggerVariants = cva(
  'flex cursor-default select-none items-center rounded-sm px-3 py-1.5 text-sm font-medium outline-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
  {
    variants: {
      variant: {
        default: '',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

interface MenubarProps
  extends React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Root>,
    VariantProps<typeof menubarVariants> {}

interface MenubarTriggerProps
  extends React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Trigger>,
    VariantProps<typeof menubarTriggerVariants> {}

type MenubarMenuProps = React.ComponentPropsWithoutRef<
  typeof MenubarPrimitive.Menu
>

type MenubarContentProps = React.ComponentPropsWithoutRef<
  typeof MenubarPrimitive.Content
>

type MenubarItemProps = React.ComponentPropsWithoutRef<
  typeof MenubarPrimitive.Item
> & {
  inset?: boolean
}

type MenubarSeparatorProps = React.ComponentPropsWithoutRef<
  typeof MenubarPrimitive.Separator
>

type MenubarLabelProps = React.ComponentPropsWithoutRef<
  typeof MenubarPrimitive.Label
>

type MenubarCheckboxItemProps = React.ComponentPropsWithoutRef<
  typeof MenubarPrimitive.CheckboxItem
>

type MenubarRadioItemProps = React.ComponentPropsWithoutRef<
  typeof MenubarPrimitive.RadioItem
>

type MenubarSubTriggerProps = React.ComponentPropsWithoutRef<
  typeof MenubarPrimitive.SubTrigger
>

type MenubarSubContentProps = React.ComponentPropsWithoutRef<
  typeof MenubarPrimitive.SubContent
>

const Menubar = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.Root>,
  MenubarProps
>(({ className, variant, ...props }, ref) => (
  <MenubarPrimitive.Root
    ref={ref}
    className={cn(menubarVariants({ variant, className }))}
    {...props}
  />
))
Menubar.displayName = MenubarPrimitive.Root.displayName

const MenubarMenu: React.FC<MenubarMenuProps> = ({ ...props }) => (
  <MenubarPrimitive.Menu {...props} />
)
MenubarMenu.displayName = (
  MenubarPrimitive.Menu as { displayName?: string }
).displayName

const MenubarTrigger = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.Trigger>,
  MenubarTriggerProps
>(({ className, variant, ...props }, ref) => (
  <MenubarPrimitive.Trigger
    ref={ref}
    className={cn(menubarTriggerVariants({ variant, className }))}
    {...props}
  />
))
MenubarTrigger.displayName = MenubarPrimitive.Trigger.displayName

const MenubarContent = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.Content>,
  MenubarContentProps
>(
  (
    { className, align = 'start', alignOffset = -4, sideOffset = 8, ...props },
    ref
  ) => (
    <MenubarPrimitive.Portal>
      <MenubarPrimitive.Content
        ref={ref}
        align={align}
        alignOffset={alignOffset}
        sideOffset={sideOffset}
        className={cn(
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[12rem] overflow-hidden rounded-md border p-1 shadow-md',
          className
        )}
        {...props}
      />
    </MenubarPrimitive.Portal>
  )
)
MenubarContent.displayName = MenubarPrimitive.Content.displayName

const MenubarItem = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.Item>,
  MenubarItemProps
>(({ className, inset, ...props }, ref) => (
  <MenubarPrimitive.Item
    ref={ref}
    className={cn(
      'focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50',
      inset && 'pl-8',
      className
    )}
    {...props}
  />
))
MenubarItem.displayName = MenubarPrimitive.Item.displayName

const MenubarCheckboxItem = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.CheckboxItem>,
  MenubarCheckboxItemProps
>(({ className, children, checked, ...props }, ref) => (
  <MenubarPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      'focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50',
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <MenubarPrimitive.ItemIndicator>
        <Check className="size-4" />
      </MenubarPrimitive.ItemIndicator>
    </span>
    {children}
  </MenubarPrimitive.CheckboxItem>
))
MenubarCheckboxItem.displayName = MenubarPrimitive.CheckboxItem.displayName

const MenubarRadioItem = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.RadioItem>,
  MenubarRadioItemProps
>(({ className, children, ...props }, ref) => (
  <MenubarPrimitive.RadioItem
    ref={ref}
    className={cn(
      'focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50',
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <MenubarPrimitive.ItemIndicator>
        <Circle className="size-2 fill-current" />
      </MenubarPrimitive.ItemIndicator>
    </span>
    {children}
  </MenubarPrimitive.RadioItem>
))
MenubarRadioItem.displayName = MenubarPrimitive.RadioItem.displayName

const MenubarLabel = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.Label>,
  MenubarLabelProps
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Label
    ref={ref}
    className={cn('px-2 py-1.5 text-sm font-semibold', className)}
    {...props}
  />
))
MenubarLabel.displayName = MenubarPrimitive.Label.displayName

const MenubarSeparator = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.Separator>,
  MenubarSeparatorProps
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Separator
    ref={ref}
    className={cn('bg-muted -mx-1 my-1 h-px', className)}
    {...props}
  />
))
MenubarSeparator.displayName = MenubarPrimitive.Separator.displayName

const MenubarShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn(
        'text-muted-foreground ml-auto text-xs tracking-widest',
        className
      )}
      {...props}
    />
  )
}
MenubarShortcut.displayName = 'MenubarShortcut'

const MenubarSub = MenubarPrimitive.Sub

const MenubarSubTrigger = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.SubTrigger>,
  MenubarSubTriggerProps
>(({ className, children, ...props }, ref) => (
  <MenubarPrimitive.SubTrigger
    ref={ref}
    className={cn(
      'focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none',
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto size-4" />
  </MenubarPrimitive.SubTrigger>
))
MenubarSubTrigger.displayName = MenubarPrimitive.SubTrigger.displayName

const MenubarSubContent = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.SubContent>,
  MenubarSubContentProps
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.SubContent
    ref={ref}
    className={cn(
      'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-32 overflow-hidden rounded-md border p-1 shadow-md',
      className
    )}
    {...props}
  />
))
MenubarSubContent.displayName = MenubarPrimitive.SubContent.displayName

const MenubarRadioGroup = MenubarPrimitive.RadioGroup

export {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarCheckboxItem,
  MenubarRadioItem,
  MenubarLabel,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarRadioGroup,
  menubarVariants,
}
