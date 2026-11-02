import { graphql, type FragmentOf } from '../../../lib/optimizely/graphql'
import displaySettingsData from './display-settings'
import type { ExtractDisplaySettingValues } from '../../../lib/optimizely/types/display-settings'

export const TableBlockFragment = graphql(`
  fragment TableBlockFragment on TableBlock {
    TableContent {
      html
    }
  }
`)

export type TableBlockDisplaySettings = ExtractDisplaySettingValues<
  (typeof displaySettingsData)[0]['settings']
>

export type TableBlockProps = FragmentOf<typeof TableBlockFragment> & {
  displaySettings?: Partial<TableBlockDisplaySettings>
  preview?: boolean
}
