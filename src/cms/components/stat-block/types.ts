import displayTemplates from './display-settings'

/**
 * `Description` is the CMS property name; `StatDescription` is the name the vendored
 * optimizely.com renderer destructures, because the GraphQL fragment aliases it
 * (`StatDescription: Description`). Both are declared so that the compose side, which writes
 * CMS property names, and the Phase 1 renderer, which reads the aliased projection, typecheck
 * against one interface.
 */
export interface StatBlockProps {
  /** The number itself, e.g. "38%". */
  StatValue?: string
  /** CMS property name. */
  Description?: string
  /** GraphQL alias of `Description`, as read by the upstream renderer. */
  StatDescription?: string
  displaySettings?: Record<string, string>
  preview?: boolean
}

export type StatBlockDisplaySettings = (typeof displayTemplates)[0]['settings']
