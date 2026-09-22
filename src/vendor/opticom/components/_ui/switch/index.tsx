import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'
import { MaterialIcon } from '@/components/element/icon-element'

const switchVariants = cva(
  'peer shrink-0 inline-flex items-center w-[42px] h-[22px] rounded-full cursor-pointer transition-colors focus-visible:outline-none disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        'ods-neutral':
          'bg-(--forms-color-switch-default-neutral) data-[state=checked]:bg-(--forms-color-switch-selected-neutral) disabled:!bg-(--forms-color-switch-disabled-neutral)',
        'ods-dark':
          'bg-(--forms-color-switch-default-dark) data-[state=checked]:bg-(--forms-color-switch-selected-dark) disabled:!bg-(--forms-color-switch-disabled-dark)',
        'ods-error-light': 'bg-(--forms-color-error-light)',
        'ods-error-neutral': 'bg-(--forms-color-error-neutral)',
        'ods-error-dark': 'bg-(--forms-color-error-dark)',
      },
    },
    defaultVariants: {
      variant: 'ods-neutral',
    },
  }
)

const switchThumbVariants = cva(
  'block size-[18px] rounded-full transition-transform duration-200 data-[state=unchecked]:translate-x-[2px] data-[state=checked]:translate-x-[22px] data-[disabled]:!bg-(--forms-color-switch-button-disabled)',
  {
    variants: {
      variant: {
        'ods-neutral': 'bg-(--forms-color-switch-button-neutral)',
        'ods-dark': 'bg-(--forms-color-switch-button-dark)',
        'ods-error-light': 'bg-(--forms-color-switch-button-neutral)',
        'ods-error-neutral': 'bg-(--forms-color-switch-button-neutral)',
        'ods-error-dark': 'bg-(--forms-color-switch-button-dark)',
      },
    },
    defaultVariants: {
      variant: 'ods-neutral',
    },
  }
)

export interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>,
    VariantProps<typeof switchVariants> {}

const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  SwitchProps
>(({ className, variant, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(switchVariants({ variant, className }))}
    {...props}
  >
    <SwitchPrimitive.Thumb className={cn(switchThumbVariants({ variant }))} />
  </SwitchPrimitive.Root>
))
Switch.displayName = SwitchPrimitive.Root.displayName

export interface SwitchWithLabelProps extends Omit<SwitchProps, 'className'> {
  label: React.ReactNode
  inputPosition?: 'left' | 'right'
  className?: string
  labelClassName?: string
}

const SwitchWithLabel = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  SwitchWithLabelProps
>(
  (
    {
      label,
      inputPosition = 'right',
      className,
      labelClassName,
      disabled,
      ...switchProps
    },
    ref
  ) => {
    const isRight = inputPosition === 'right'
    const input = (
      <div className="flex shrink-0 items-center gap-1">
        <Switch ref={ref} disabled={disabled} {...switchProps} />
        {disabled && (
          <MaterialIcon
            name="lock"
            size="20"
            weight="400"
            fill="1"
            color="var(--forms-color-label-disabled)"
          />
        )}
      </div>
    )

    return (
      <label
        className={cn(
          'flex cursor-pointer items-center has-[:focus-visible]:rounded-[4px] has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-offset-[8px] has-[:focus-visible]:outline-(--color-secondary-ltblue) has-[:focus-visible]:outline-solid',
          isRight ? 'gap-8' : 'gap-3',
          disabled && 'cursor-not-allowed',
          className
        )}
      >
        {isRight ? (
          <>
            <span className={cn('flex-1 select-none', labelClassName)}>
              {label}
            </span>
            {input}
          </>
        ) : (
          <>
            {input}
            <span className={cn('select-none', labelClassName)}>{label}</span>
          </>
        )}
      </label>
    )
  }
)
SwitchWithLabel.displayName = 'SwitchWithLabel'

export { Switch, SwitchWithLabel, switchVariants, switchThumbVariants }
