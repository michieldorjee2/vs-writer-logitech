/**
 * SHIM (ours): trimmed barrel. Upstream's re-exports OnPageEdit and FormCompleteToggle, which
 * need next/navigation and a Graph client. Only the two pass-through wrappers are used here.
 */
import { createElement, type ElementType } from 'react'
export { EditableField } from './editable-field'

/** Upstream's EditableHtml, non-edit branch: renders `html` into the given element. */
export function EditableHtml({
  field: _field,
  html,
  as = 'div',
  className,
  ...props
}: {
  field?: string
  html: string
  as?: ElementType
  className?: string
  [key: string]: unknown
}) {
  return createElement(as, { className, ...props, dangerouslySetInnerHTML: { __html: html } })
}
