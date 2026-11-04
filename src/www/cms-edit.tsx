/**
 * On-page editing in the CMS: the hooks the Optimizely SaaS CMS editor outlines when it shows a
 * page in its preview (src/components/CmsPreview.tsx, `ctx=edit`).
 *
 * The attributes come from Optimizely's CMS SDK (`getPreviewUtils(...).pa`): `pa('techStack')` is
 * `data-epi-edit="techStack"` on a page property, `pa({ key })` is `data-epi-block-id` on a Visual
 * Builder section or element. Outside the CMS editor both are `{}`, so the live pages, which never
 * mount the provider, render exactly what they did: the server render and hydration are unchanged.
 *
 * What the CMS can edit is what the CMS stores. On the agent platform page that is the page fields
 * the template shows (USED_FIELDS in ./agent-platform/content.ts): the logo, the stats, the stack,
 * the investments, the stakeholders, the team and the small print. The headlines and body text are
 * the template's own copy (src/lib/page-copy.ts), kept beside the page and changed in Showcase's
 * Edit mode, so the CMS has nothing to outline there. On an offer page every section and element is
 * a Visual Builder node, so each one is outlined and opens in the editor.
 */
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { getPreviewUtils } from '@optimizely/cms-sdk/core'

type Attrs = Record<string, string>

interface CmsEdit {
  /** The CMS editor is showing this page (`ctx=edit`). */
  editing: boolean
  /** A page property's hook: `data-epi-edit`. */
  field: (property: string) => Attrs
  /** A Visual Builder node's hook: `data-epi-block-id`. No key, no hook. */
  block: (key: string | null | undefined) => Attrs
}

const none = (): Attrs => ({})
const Ctx = createContext<CmsEdit>({ editing: false, field: none, block: none })

export function CmsEditProvider({ editing, children }: { editing: boolean; children: ReactNode }) {
  const value = useMemo<CmsEdit>(() => {
    // `pa` reads only `edit`; the token is the media helper's, which these pages don't use.
    const { pa } = getPreviewUtils({ __context: { edit: editing, preview_token: '' } })
    return {
      editing,
      field: (property) => pa(property),
      block: (key) => (key ? pa({ key }) : {}),
    }
  }, [editing])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useCmsEdit = () => useContext(Ctx)

/**
 * The hooks for an element that shows one stored field: Edit mode's (`data-field`, which a live
 * edit flashes: src/components/EditMode.tsx) and, in the CMS editor, the CMS's (`data-epi-edit`).
 */
export function useShowsField(): (property: string) => Attrs {
  const { field } = useCmsEdit()
  return useCallback((property: string) => ({ 'data-field': property, ...field(property) }), [field])
}
