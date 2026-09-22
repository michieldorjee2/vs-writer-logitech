/**
 * AbmAnalystCardElement — one analyst or third-party proof point.
 *
 * No optimizely.com upstream: the block catalogue has no analyst card. The existing Showcase
 * `_component` type `ABMAnalystCard` is a list-item on `CompetitorComparisonPage`, has no
 * display template and cannot be placed in a composition, so this is a new, separately keyed
 * Visual Builder element rather than a change to that frozen type.
 *
 * The quote and its source live on a sibling `BlockquoteBlock` node in the same column; this
 * element carries the surrounding chrome — the badge, the source, the category and the link.
 */
import { sequence, shortString, url, type ContentTypeDefinition } from '../../property-builders'

const contentType: ContentTypeDefinition = {
  key: 'AbmAnalystCardElement',
  displayName: 'ABM · Analyst Card',
  description:
    'One analyst or third-party proof point: a badge, its source, a category and a link out.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled'],
  properties: sequence({
    Badge: shortString('Badge', {
      description: 'The claim in as few words as possible, e.g. "Leader, 2026 Magic Quadrant".',
      required: true,
    }),
    Source: shortString('Source', {
      description: 'Who published it, e.g. "Gartner" or "Forrester".',
    }),
    Category: shortString('Category', {
      description: 'The market or report category the recognition sits in.',
    }),
    Url: url('URL', {
      description: 'Where the proof point links — the report, review page or press release.',
    }),
  }),
}

export default contentType
