import {
  sequence,
  stringArray,
  type ContentTypeDefinition,
} from '../../property-builders'

/**
 * The three lines in the foot of the left nav rail — today's `railMeta` page field
 * (`src/lib/limitless/use-case-content.ts`, read by `readRailMeta()`), e.g.
 * `['Industrial · Xcelerator Era', 'Prepared for Siemens', 'NA · 2026']`.
 *
 * `RailLines` stays an array rather than exploding into one node per line, because an
 * `array` of `{type: 'string'}` is one of the eight element-legal shapes and the three lines
 * are a single typographic block an editor edits together — not three independently
 * placeable, prunable items. The rail's brand line and its section nav are derived from the
 * page and its component plan, so neither belongs on this element.
 */
const contentType: ContentTypeDefinition = {
  key: 'AbmNavRailElement',
  displayName: 'ABM · Nav Rail',
  description:
    'The foot of the left nav rail: up to three short context lines, rendered one per line ' +
    'in small type under the section nav.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled'],
  properties: sequence({
    RailLines: stringArray('Rail lines', {
      description:
        'Up to three short lines, in order — typically the account eyebrow, who the page was ' +
        'prepared for, then region and year. Leave empty to fall back to the derived lines.',
      maxItems: 3,
    }),
  }),
}

export default contentType
