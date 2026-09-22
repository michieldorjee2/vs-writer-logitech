import {
  type ReactNode,
  type ElementType,
  type ComponentPropsWithoutRef,
} from 'react'
import { useDraftMode } from './draft-mode-context'
import { draftClass } from '@/lib/utils/draft-helpers'
import { cn } from '@/lib/utils'

type EditableBlockProps<T extends ElementType = 'div'> = {
  blockId: string
  as?: T
  children: ReactNode
  className?: string
  visualBuilderClass?: string
} & Omit<ComponentPropsWithoutRef<T>, 'children' | 'className'>

export function EditableBlock<T extends ElementType = 'div'>({
  blockId,
  as,
  children,
  className,
  visualBuilderClass = 'vb:node',
  ...props
}: EditableBlockProps<T>) {
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

  const Component = (as || 'div') as ElementType

  return (
    <Component
      data-epi-block-id={blockId}
      className={cn(className, draftClass(isEditMode, visualBuilderClass))}
      {...props}
    >
      {children}
    </Component>
  )
}

type EditableContentAreaProps<T extends ElementType = 'div'> = {
  field: string
  as?: T
  children: ReactNode
  className?: string
} & Omit<ComponentPropsWithoutRef<T>, 'children' | 'className'>

export function EditableContentArea<T extends ElementType = 'div'>({
  field,
  as,
  children,
  className,
  ...props
}: EditableContentAreaProps<T>) {
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

  const Component = (as || 'div') as ElementType

  return (
    <Component data-epi-edit={field} className={className} {...props}>
      {children}
    </Component>
  )
}
