import * as React from 'react'
import * as FormPrimitive from '@radix-ui/react-form'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const formFieldVariants = cva('flex flex-col gap-1', {
  variants: {
    variant: {
      default: '',
      error: '',
      success: '',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

const formFieldContainerVariants = cva(
  'relative flex flex-col px-4 py-[13px] rounded-(--radius-form-field) h-[61px] overflow-hidden justify-center transition-all border-2 has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-(--color-secondary-ltblue) focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-(--color-secondary-ltblue)',
  {
    variants: {
      variant: {
        default: 'border-transparent',
        error: '',
        success: 'border-(--forms-color-valid)',
      },
      colorScheme: {
        white: 'bg-(--forms-color-background-field-white)',
        neutral: 'bg-(--forms-color-background-field-neutral)',
      },
    },
    compoundVariants: [
      {
        variant: 'error',
        colorScheme: 'white',
        class: 'border-(--forms-color-error-dark)',
      },
      {
        variant: 'error',
        colorScheme: 'neutral',
        class: 'border-(--forms-color-error-neutral)',
      },
    ],
    defaultVariants: {
      variant: 'default',
      colorScheme: 'white',
    },
  }
)

const formLabelVariants = cva(
  'transition-all duration-200 peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
  {
    variants: {
      variant: {
        default: 'text-(--forms-color-label-white)',
        error: 'text-(--forms-color-error)',
        success: 'text-(--forms-color-valid)',
        disabled: 'text-(--forms-color-label-disabled)',
      },
      floating: {
        true: 'text-(length:--forms-text-label-active) font-normal leading-none',
        false:
          'text-(length:--forms-text-label-default) font-medium leading-[1.3]',
      },
    },
    defaultVariants: {
      variant: 'default',
      floating: false,
    },
  }
)

const formControlVariants = cva(
  'flex h-10 w-full rounded-(--radius-form-field) border px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-(--forms-color-input-placeholder) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'border-(--forms-color-label-white) focus-visible:ring-(--forms-color-label-white)',
        error:
          'border-(--forms-color-error) focus-visible:ring-(--forms-color-error)',
        success:
          'border-(--forms-color-valid) focus-visible:ring-(--forms-color-valid)',
      },
      embedded: {
        true: 'h-auto w-full bg-transparent border-none px-0 py-0 rounded-none shadow-none text-(length:--forms-text-label-default) text-(--forms-color-input-default) font-(family-name:--font-forms) font-medium leading-[1.3] placeholder:text-(--forms-color-input-placeholder) placeholder:transition-opacity placeholder:duration-200 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      embedded: false,
    },
  }
)

const formMessageVariants = cva(
  'px-4 text-(length:--forms-text-label-active) font-(family-name:--font-forms) font-normal leading-none',
  {
    variants: {
      variant: {
        default: 'text-(--forms-color-helper-neutral)',
        error: '',
        success: 'text-(--forms-color-valid)',
      },
      colorScheme: {
        white: '',
        neutral: '',
      },
    },
    compoundVariants: [
      { variant: 'default', colorScheme: 'white', class: 'text-white' },
      {
        variant: 'error',
        colorScheme: 'white',
        class: 'text-(--forms-color-error-dark)',
      },
      {
        variant: 'error',
        colorScheme: 'neutral',
        class: 'text-(--forms-color-error-neutral)',
      },
    ],
    defaultVariants: {
      variant: 'default',
      colorScheme: 'neutral',
    },
  }
)

const Form = FormPrimitive.Root

interface FormFieldProps
  extends React.ComponentPropsWithoutRef<typeof FormPrimitive.Field>,
    VariantProps<typeof formFieldVariants> {}

const FormField = React.forwardRef<
  React.ComponentRef<typeof FormPrimitive.Field>,
  FormFieldProps
>(({ className, variant, ...props }, ref) => (
  <FormPrimitive.Field
    ref={ref}
    className={cn(formFieldVariants({ variant, className }))}
    {...props}
  />
))
FormField.displayName = FormPrimitive.Field.displayName

interface FormFieldContainerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof formFieldContainerVariants> {}

const FormFieldContainer = React.forwardRef<
  HTMLDivElement,
  FormFieldContainerProps
>(({ className, variant, colorScheme, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      formFieldContainerVariants({ variant, colorScheme, className })
    )}
    {...props}
  />
))
FormFieldContainer.displayName = 'FormFieldContainer'

interface FormLabelProps
  extends React.ComponentPropsWithoutRef<typeof FormPrimitive.Label>,
    VariantProps<typeof formLabelVariants> {}

const FormLabel = React.forwardRef<
  React.ComponentRef<typeof FormPrimitive.Label>,
  FormLabelProps
>(({ className, variant, floating, ...props }, ref) => (
  <FormPrimitive.Label
    ref={ref}
    className={cn(formLabelVariants({ variant, floating, className }))}
    {...props}
  />
))
FormLabel.displayName = FormPrimitive.Label.displayName

interface FormControlProps
  extends React.ComponentPropsWithoutRef<typeof FormPrimitive.Control>,
    VariantProps<typeof formControlVariants> {}

const FormControl = React.forwardRef<
  React.ComponentRef<typeof FormPrimitive.Control>,
  FormControlProps
>(({ className, variant, embedded, ...props }, ref) => (
  <FormPrimitive.Control
    ref={ref}
    className={cn(formControlVariants({ variant, embedded, className }))}
    {...props}
  />
))
FormControl.displayName = FormPrimitive.Control.displayName

interface FormMessageProps
  extends React.ComponentPropsWithoutRef<typeof FormPrimitive.Message>,
    VariantProps<typeof formMessageVariants> {}

const FormMessage = React.forwardRef<
  React.ComponentRef<typeof FormPrimitive.Message>,
  FormMessageProps
>(({ className, variant, colorScheme, ...props }, ref) => (
  <FormPrimitive.Message
    ref={ref}
    className={cn(formMessageVariants({ variant, colorScheme, className }))}
    {...props}
  />
))
FormMessage.displayName = FormPrimitive.Message.displayName

const FormValidityState = FormPrimitive.ValidityState

const FormSubmit = React.forwardRef<
  React.ComponentRef<typeof FormPrimitive.Submit>,
  React.ComponentPropsWithoutRef<typeof FormPrimitive.Submit>
>(({ className, ...props }, ref) => (
  <FormPrimitive.Submit
    ref={ref}
    className={cn(
      'focus-visible:ring-ring inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium whitespace-nowrap text-white shadow transition-colors hover:bg-blue-500 focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
      className
    )}
    {...props}
  />
))
FormSubmit.displayName = FormPrimitive.Submit.displayName

export {
  Form,
  FormField,
  FormFieldContainer,
  FormLabel,
  FormControl,
  FormMessage,
  FormValidityState,
  FormSubmit,
  formFieldVariants,
  formFieldContainerVariants,
  formLabelVariants,
  formControlVariants,
  formMessageVariants,
}
