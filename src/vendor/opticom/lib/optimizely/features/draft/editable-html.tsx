import { type ElementType, type ComponentPropsWithoutRef } from 'react'

interface EditableHtmlProps<T extends ElementType = 'div'> {
  field: string
  html: string | null | undefined
  as?: T
  className?: string
}

export function EditableHtml<T extends ElementType = 'div'>({
  field,
  html,
  as,
  className,
  ...props
}: EditableHtmlProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof EditableHtmlProps<T>>) {
  const Component = (as || 'div') as ElementType

  if (!html) return null

  return (
    <Component
      data-epi-edit={field}
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
      {...props}
    />
  )
}
