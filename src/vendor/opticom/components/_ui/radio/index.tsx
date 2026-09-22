import * as React from 'react'
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { Circle } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const radioGroupVariants = cva('grid gap-2', {
  variants: {
    orientation: {
      vertical: 'grid gap-2',
      horizontal: 'flex gap-4',
    },
  },
  defaultVariants: {
    orientation: 'vertical',
  },
})

const radioItemVariants = cva(
  'peer shrink-0 rounded-full inline-flex items-center justify-center size-5 border-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:animate-[checkbox-pulse_0.4s_ease-out]',
  {
    variants: {
      variant: {
        'ods-neutral':
          'border-(--forms-color-checkbox-neutral) text-(color:--forms-color-checkbox-neutral)',
        'ods-dark':
          'border-(--forms-color-checkbox-dark) text-(color:--forms-color-checkbox-dark)',
        'ods-error-light':
          'border-(--forms-color-error-light) text-(color:--forms-color-error-light)',
        'ods-error-neutral':
          'border-(--forms-color-error-neutral) text-(color:--forms-color-error-neutral)',
        'ods-error-dark':
          'border-(--forms-color-error-dark) text-(color:--forms-color-error-dark)',
      },
      size: {
        default: 'size-5',
        none: '',
      },
    },
    defaultVariants: {
      variant: 'ods-neutral',
      size: 'default',
    },
  }
)

export interface RadioGroupProps
  extends Omit<
      React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>,
      'orientation'
    >,
    VariantProps<typeof radioGroupVariants> {}

export interface RadioGroupItemProps
  extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>,
    VariantProps<typeof radioItemVariants> {}

const RadioGroup = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Root>,
  RadioGroupProps
>(({ className, orientation, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      className={cn(radioGroupVariants({ orientation, className }))}
      {...props}
      ref={ref}
    />
  )
})
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName

const RadioGroupItem = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Item>,
  RadioGroupItemProps
>(({ className, variant, size, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(radioItemVariants({ variant, size, className }))}
    {...props}
  >
    <RadioGroupPrimitive.Indicator
      className="flex items-center justify-center"
      forceMount
    >
      <Circle className="size-2.5 scale-0 fill-current text-current opacity-0 in-data-[state=checked]:scale-100 in-data-[state=checked]:animate-[checkmark-pop_0.6s_ease-out] in-data-[state=checked]:opacity-100" />
    </RadioGroupPrimitive.Indicator>
  </RadioGroupPrimitive.Item>
))
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName

export interface RadioItemWithLabelProps
  extends Omit<RadioGroupItemProps, 'className'> {
  label: React.ReactNode
  inputPosition?: 'left' | 'right'
  className?: string
  labelClassName?: string
}

const RadioItemWithLabel = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Item>,
  RadioItemWithLabelProps
>(
  (
    {
      label,
      inputPosition = 'left',
      className,
      labelClassName,
      disabled,
      ...radioProps
    },
    ref
  ) => {
    const isRight = inputPosition === 'right'
    const input = (
      <div className="shrink-0 py-[2px]">
        <RadioGroupItem ref={ref} disabled={disabled} {...radioProps} />
      </div>
    )

    return (
      <label
        className={cn(
          'flex cursor-pointer items-start has-[:focus-visible]:rounded-[4px] has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-offset-[8px] has-[:focus-visible]:outline-(--color-secondary-ltblue) has-[:focus-visible]:outline-solid',
          isRight ? 'gap-8' : 'gap-3',
          disabled && 'cursor-not-allowed opacity-50',
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
RadioItemWithLabel.displayName = 'RadioItemWithLabel'

export {
  RadioGroup,
  RadioGroupItem,
  RadioItemWithLabel,
  radioGroupVariants,
  radioItemVariants,
}
