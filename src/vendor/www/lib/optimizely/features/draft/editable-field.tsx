/**
 * SHIM (ours). Upstream's EditableField reads draft-mode context to add `data-epi-edit`
 * hooks for the CMS on-page editor. The www-design pages are never edited in place (Showcase
 * edit mode targets the legacy renderers), so this is upstream's non-edit branch only.
 */
import type { ReactNode, ElementType, ComponentPropsWithoutRef } from 'react'

type EditableFieldProps<T extends ElementType = 'span'> = {
  field: string
  as?: T
  children: ReactNode
  className?: string
} & Omit<ComponentPropsWithoutRef<T>, 'children' | 'className'>

export function EditableField<T extends ElementType = 'span'>({
  field: _field,
  as,
  children,
  className,
  ...props
}: EditableFieldProps<T>) {
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
