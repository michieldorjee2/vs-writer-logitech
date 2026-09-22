import {
  type ReactNode,
  type ElementType,
  type ComponentPropsWithoutRef,
} from 'react'
import { useDraftMode } from './draft-mode-context'

type EditableFieldProps<T extends ElementType = 'span'> = {
  field: string
  as?: T
  children: ReactNode
  className?: string
} & Omit<ComponentPropsWithoutRef<T>, 'children' | 'className'>

export function EditableField<T extends ElementType = 'span'>({
  field,
  as,
  children,
  className,
  ...props
}: EditableFieldProps<T>) {
  const isEditMode = useDraftMode()

  if (!isEditMode) {
    if (as) {
      const Component = as as ElementType
      return (
        <Component className={className} {...props}>
          {children}
        </Component>
      )
    }
    return <>{children}</>
  }

  const Component = (as || 'span') as ElementType

  return (
    <Component data-epi-edit={field} className={className} {...props}>
      {children}
    </Component>
  )
}
