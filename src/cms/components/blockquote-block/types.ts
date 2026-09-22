import displayTemplates from './display-settings'

/**
 * Props for the Phase 1 renderer. The names match upstream's
 * `ExtendedBlockquoteBlockProps` so the vendored React component drops in unchanged.
 */
export interface BlockquoteBlockProps {
  Quote?: string
  AuthorName?: string
  AuthorTitle?: string
  displaySettings?: Record<string, string>
  preview?: boolean
}

export type BlockquoteBlockDisplaySettings = (typeof displayTemplates)[0]['settings']
