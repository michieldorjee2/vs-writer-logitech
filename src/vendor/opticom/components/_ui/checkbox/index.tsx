import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const checkboxVariants = cva(
  'peer shrink-0 inline-flex items-center justify-center size-5 rounded-3xs border-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:animate-[checkbox-pulse_0.4s_ease-out]',
  {
    variants: {
      variant: {
        'ods-neutral':
          'border-(--forms-color-checkbox-neutral) data-[state=checked]:bg-(--forms-color-checkbox-neutral) data-[state=checked]:text-white',
        'ods-dark':
          'border-(--forms-color-checkbox-dark) data-[state=checked]:bg-(--forms-color-checkbox-dark) data-[state=checked]:text-(color:--forms-color-checkbox-neutral)',
        'ods-error-light':
          'border-(--forms-color-error-light) data-[state=checked]:bg-(--forms-color-error-light) data-[state=checked]:text-white',
        'ods-error-neutral':
          'border-(--forms-color-error-neutral) data-[state=checked]:bg-(--forms-color-error-neutral) data-[state=checked]:text-white',
        'ods-error-dark':
          'border-(--forms-color-error-dark) data-[state=checked]:bg-(--forms-color-error-dark) data-[state=checked]:text-white',
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

export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
    VariantProps<typeof checkboxVariants> {}

const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, variant, size, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(checkboxVariants({ variant, size, className }))}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className="flex items-center justify-center text-current"
      forceMount
    >
      <Check
        className={cn(
          'size-3.5 scale-0 opacity-0 in-data-[state=checked]:scale-100 in-data-[state=checked]:animate-[checkmark-pop_0.6s_ease-out] in-data-[state=checked]:opacity-100',
          size === 'none' && 'size-3.5'
        )}
      />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))

Checkbox.displayName = CheckboxPrimitive.Root.displayName

export interface CheckboxWithLabelProps
  extends Omit<CheckboxProps, 'className'> {
  label: React.ReactNode
  inputPosition?: 'left' | 'right'
  className?: string
  labelClassName?: string
}

const CheckboxWithLabel = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  CheckboxWithLabelProps
>(
  (
    {
      label,
      inputPosition = 'left',
      className,
      labelClassName,
      disabled,
      ...checkboxProps
    },
    ref
  ) => {
    const isRight = inputPosition === 'right'
    const input = (
      <div className="shrink-0 py-[2px]">
        <Checkbox ref={ref} disabled={disabled} {...checkboxProps} />
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
CheckboxWithLabel.displayName = 'CheckboxWithLabel'

export { Checkbox, CheckboxWithLabel, checkboxVariants }
