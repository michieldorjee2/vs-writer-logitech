/**
 * SHIM — a trimmed copy of upstream's barrel. See UPSTREAM.md.
 *
 * Upstream re-exports two more modules from here: `on-page-edit` and `draft-actions`. Both
 * import `next/navigation` (`usePathname`, `useRouter`) and drive the CMS on-page-edit
 * toolbar, which the Showcase has no route for. They are not vendored, so they are not
 * re-exported.
 *
 * Everything below IS vendored byte-for-byte (minus `'use client'`), so `EditableBlock`
 * behaves exactly as it does on optimizely.com: outside draft mode it renders its children
 * with no wrapper at all, and inside it adds `data-epi-block-id` plus the `vb:` outline
 * classes. The Showcase never mounts `DraftModeProvider`, so `useDraftMode()` reads the
 * context default of `false` and every node renders unwrapped — which is what we want until
 * a Visual Builder preview route exists.
 */
export {
  DraftModeProvider,
  useEditMode,
  useDraftMode,
  withDraftMode,
  useEditableProps,
  useBlockProps,
} from './draft-mode-context'

export { EditableField } from './editable-field'
export { EditableHtml } from './editable-html'

export { EditableBlock, EditableContentArea } from './editable-block'
