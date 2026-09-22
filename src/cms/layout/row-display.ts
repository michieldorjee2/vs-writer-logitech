/**
 * Display template for a Visual Builder `row` node.
 *
 * Copied verbatim from optimizely.com's `components/layout/row/display-settings.ts` — all
 * sixteen settings, their options and their defaults, unchanged. This is the corporate site's
 * grid model: a twelve-column grid with per-breakpoint column counts (`gridColumns`,
 * `gridColumnsMd`, `gridColumnsLg`, `gridColumnsXl`, where every breakpoint above the base
 * can `inherit`), one gap ladder with optional per-axis overrides, and the full CSS grid
 * alignment vocabulary. Reproducing it rather than inventing a smaller one is what lets a
 * Limitless row and an optimizely.com row lay out identically.
 *
 * It is keyed on `nodeType: 'row'`, not on a content type: rows and columns carry no
 * component, only `displaySettings` and `nodes`.
 *
 * Upstream's `hasDisplayTypes` / `hasDirectory` / `hasComponent` / `isVisualBuilderEnabled` /
 * `inCMS` flags are outside the canonical repo shape and are not carried. `defaultValue` is
 * repo-only — the CMS stores no defaults.
 *
 * Several settings have no `defaultValue` upstream. That is not an omission to fix here:
 * `extractDefaults()` falls back to the FIRST option, which is exactly upstream's own
 * behaviour, and `inherit` / `auto` are first for precisely that reason.
 *
 * NOTE ON DISCOVERY: `registry.ts` does not glob `layout/`, so `apply.ts` will not push this
 * template until it does.
 */
import type { RepoDisplayTemplate } from '../display-template-transform'

const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'RowDisplayTemplate',
    displayName: 'Row Display Template',
    description: 'Display template for Visual Builder rows',
    nodeType: 'row',
    isDefault: true,
    settings: [
      {
        key: 'displayMode',
        displayName: 'Display Mode',
        description: 'Layout display mode',
        type: 'select',
        required: false,
        options: [
          {
            value: 'grid',
            displayName: 'Grid',
          },
          {
            value: 'flex',
            displayName: 'Flex',
          },
        ],
        defaultValue: 'grid',
      },
      {
        key: 'gridColumns',
        displayName: 'Grid Columns',
        description: 'Number of columns in the grid (base/sm breakpoint)',
        type: 'select',
        required: false,
        options: [
          {
            value: 'auto',
            displayName: 'Auto',
          },
          {
            value: 'none',
            displayName: 'None',
          },
          {
            value: 'cols_1',
            displayName: '1 Column',
          },
          {
            value: 'cols_2',
            displayName: '2 Columns',
          },
          {
            value: 'cols_3',
            displayName: '3 Columns',
          },
          {
            value: 'cols_4',
            displayName: '4 Columns',
          },
          {
            value: 'cols_5',
            displayName: '5 Columns',
          },
          {
            value: 'cols_6',
            displayName: '6 Columns',
          },
          {
            value: 'cols_7',
            displayName: '7 Columns',
          },
          {
            value: 'cols_8',
            displayName: '8 Columns',
          },
          {
            value: 'cols_9',
            displayName: '9 Columns',
          },
          {
            value: 'cols_10',
            displayName: '10 Columns',
          },
          {
            value: 'cols_11',
            displayName: '11 Columns',
          },
          {
            value: 'cols_12',
            displayName: '12 Columns',
          },
        ],
        defaultValue: 'cols_1',
      },
      {
        key: 'gridColumnsMd',
        displayName: 'Grid Columns (md)',
        description: 'Number of columns at md breakpoint and above',
        type: 'select',
        required: false,
        options: [
          {
            value: 'inherit',
            displayName: 'Inherit from base',
          },
          {
            value: 'auto',
            displayName: 'Auto',
          },
          {
            value: 'none',
            displayName: 'None',
          },
          {
            value: 'cols_1',
            displayName: '1 Column',
          },
          {
            value: 'cols_2',
            displayName: '2 Columns',
          },
          {
            value: 'cols_3',
            displayName: '3 Columns',
          },
          {
            value: 'cols_4',
            displayName: '4 Columns',
          },
          {
            value: 'cols_5',
            displayName: '5 Columns',
          },
          {
            value: 'cols_6',
            displayName: '6 Columns',
          },
          {
            value: 'cols_7',
            displayName: '7 Columns',
          },
          {
            value: 'cols_8',
            displayName: '8 Columns',
          },
          {
            value: 'cols_9',
            displayName: '9 Columns',
          },
          {
            value: 'cols_10',
            displayName: '10 Columns',
          },
          {
            value: 'cols_11',
            displayName: '11 Columns',
          },
          {
            value: 'cols_12',
            displayName: '12 Columns',
          },
        ],
        defaultValue: 'inherit',
      },
      {
        key: 'gridColumnsLg',
        displayName: 'Grid Columns (lg)',
        description: 'Number of columns at lg breakpoint and above',
        type: 'select',
        required: false,
        options: [
          {
            value: 'inherit',
            displayName: 'Inherit from md',
          },
          {
            value: 'auto',
            displayName: 'Auto',
          },
          {
            value: 'none',
            displayName: 'None',
          },
          {
            value: 'cols_1',
            displayName: '1 Column',
          },
          {
            value: 'cols_2',
            displayName: '2 Columns',
          },
          {
            value: 'cols_3',
            displayName: '3 Columns',
          },
          {
            value: 'cols_4',
            displayName: '4 Columns',
          },
          {
            value: 'cols_5',
            displayName: '5 Columns',
          },
          {
            value: 'cols_6',
            displayName: '6 Columns',
          },
          {
            value: 'cols_7',
            displayName: '7 Columns',
          },
          {
            value: 'cols_8',
            displayName: '8 Columns',
          },
          {
            value: 'cols_9',
            displayName: '9 Columns',
          },
          {
            value: 'cols_10',
            displayName: '10 Columns',
          },
          {
            value: 'cols_11',
            displayName: '11 Columns',
          },
          {
            value: 'cols_12',
            displayName: '12 Columns',
          },
        ],
        defaultValue: 'inherit',
      },
      {
        key: 'gridColumnsXl',
        displayName: 'Grid Columns (xl)',
        description: 'Number of columns at xl breakpoint and above',
        type: 'select',
        required: false,
        options: [
          {
            value: 'inherit',
            displayName: 'Inherit from lg',
          },
          {
            value: 'auto',
            displayName: 'Auto',
          },
          {
            value: 'none',
            displayName: 'None',
          },
          {
            value: 'cols_1',
            displayName: '1 Column',
          },
          {
            value: 'cols_2',
            displayName: '2 Columns',
          },
          {
            value: 'cols_3',
            displayName: '3 Columns',
          },
          {
            value: 'cols_4',
            displayName: '4 Columns',
          },
          {
            value: 'cols_5',
            displayName: '5 Columns',
          },
          {
            value: 'cols_6',
            displayName: '6 Columns',
          },
          {
            value: 'cols_7',
            displayName: '7 Columns',
          },
          {
            value: 'cols_8',
            displayName: '8 Columns',
          },
          {
            value: 'cols_9',
            displayName: '9 Columns',
          },
          {
            value: 'cols_10',
            displayName: '10 Columns',
          },
          {
            value: 'cols_11',
            displayName: '11 Columns',
          },
          {
            value: 'cols_12',
            displayName: '12 Columns',
          },
        ],
        defaultValue: 'inherit',
      },
      {
        key: 'gridRows',
        displayName: 'Grid Rows',
        description: 'Number of rows in the grid',
        type: 'select',
        required: false,
        options: [
          {
            value: 'auto',
            displayName: 'Auto',
          },
          {
            value: 'none',
            displayName: 'None',
          },
          {
            value: 'rows_1',
            displayName: '1 Row',
          },
          {
            value: 'rows_2',
            displayName: '2 Rows',
          },
          {
            value: 'rows_3',
            displayName: '3 Rows',
          },
          {
            value: 'rows_4',
            displayName: '4 Rows',
          },
          {
            value: 'rows_5',
            displayName: '5 Rows',
          },
          {
            value: 'rows_6',
            displayName: '6 Rows',
          },
        ],
        defaultValue: 'auto',
      },
      {
        key: 'gap',
        displayName: 'Gap',
        description: 'Spacing between columns and rows',
        type: 'select',
        required: false,
        options: [
          {
            value: 'none',
            displayName: 'None (0)',
          },
          {
            value: 'xs',
            displayName: 'Extra Small (0.5rem)',
          },
          {
            value: 'sm',
            displayName: 'Small (1rem)',
          },
          {
            value: 'md',
            displayName: 'Medium (1.5rem)',
          },
          {
            value: 'lg',
            displayName: 'Large (2rem)',
          },
          {
            value: 'xl',
            displayName: 'Extra Large (3rem)',
          },
        ],
        defaultValue: 'sm',
      },
      {
        key: 'columnGap',
        displayName: 'Column Gap',
        description: 'Horizontal spacing between columns (overrides gap)',
        type: 'select',
        required: false,
        options: [
          {
            value: 'inherit',
            displayName: 'Use Gap Setting',
          },
          {
            value: 'none',
            displayName: 'None',
          },
          {
            value: 'xs',
            displayName: 'Extra Small',
          },
          {
            value: 'sm',
            displayName: 'Small',
          },
          {
            value: 'md',
            displayName: 'Medium',
          },
          {
            value: 'lg',
            displayName: 'Large',
          },
          {
            value: 'xl',
            displayName: 'Extra Large',
          },
        ],
        defaultValue: 'sm',
      },
      {
        key: 'rowGap',
        displayName: 'Row Gap',
        description: 'Vertical spacing between rows (overrides gap)',
        type: 'select',
        required: false,
        options: [
          {
            value: 'inherit',
            displayName: 'Use Gap Setting',
          },
          {
            value: 'none',
            displayName: 'None',
          },
          {
            value: 'xs',
            displayName: 'Extra Small',
          },
          {
            value: 'sm',
            displayName: 'Small',
          },
          {
            value: 'md',
            displayName: 'Medium',
          },
          {
            value: 'lg',
            displayName: 'Large',
          },
          {
            value: 'xl',
            displayName: 'Extra Large',
          },
        ],
        defaultValue: 'inherit',
      },
      {
        key: 'justifyItems',
        displayName: 'Justify Items',
        description: 'Horizontal alignment of grid items',
        type: 'select',
        required: false,
        options: [
          {
            value: 'default',
            displayName: 'Default (Stretch)',
          },
          {
            value: 'start',
            displayName: 'Start',
          },
          {
            value: 'center',
            displayName: 'Center',
          },
          {
            value: 'end',
            displayName: 'End',
          },
        ],
        defaultValue: 'default',
      },
      {
        key: 'alignItems',
        displayName: 'Align Items',
        description: 'Vertical alignment of grid items',
        type: 'select',
        required: false,
        options: [
          {
            value: 'default',
            displayName: 'Default (Stretch)',
          },
          {
            value: 'start',
            displayName: 'Start',
          },
          {
            value: 'center',
            displayName: 'Center',
          },
          {
            value: 'end',
            displayName: 'End',
          },
          {
            value: 'baseline',
            displayName: 'Baseline',
          },
        ],
        defaultValue: 'default',
      },
      {
        key: 'justifyContent',
        displayName: 'Justify Content',
        description: 'Distribution of columns in grid',
        type: 'select',
        required: false,
        options: [
          {
            value: 'default',
            displayName: 'Default (Start)',
          },
          {
            value: 'center',
            displayName: 'Center',
          },
          {
            value: 'end',
            displayName: 'End',
          },
          {
            value: 'between',
            displayName: 'Space Between',
          },
          {
            value: 'around',
            displayName: 'Space Around',
          },
          {
            value: 'evenly',
            displayName: 'Space Evenly',
          },
        ],
        defaultValue: 'default',
      },
      {
        key: 'alignContent',
        displayName: 'Align Content',
        description: 'Distribution of rows in grid',
        type: 'select',
        required: false,
        options: [
          {
            value: 'default',
            displayName: 'Default (Start)',
          },
          {
            value: 'center',
            displayName: 'Center',
          },
          {
            value: 'end',
            displayName: 'End',
          },
          {
            value: 'between',
            displayName: 'Space Between',
          },
          {
            value: 'around',
            displayName: 'Space Around',
          },
          {
            value: 'evenly',
            displayName: 'Space Evenly',
          },
        ],
        defaultValue: 'default',
      },
      {
        key: 'gridAutoFlow',
        displayName: 'Grid Auto Flow',
        description: 'How auto-placed items flow in the grid',
        type: 'select',
        required: false,
        options: [
          {
            value: 'row',
            displayName: 'Row (Default)',
          },
          {
            value: 'col',
            displayName: 'Column',
          },
          {
            value: 'dense',
            displayName: 'Dense',
          },
          {
            value: 'row_dense',
            displayName: 'Row Dense',
          },
          {
            value: 'col_dense',
            displayName: 'Column Dense',
          },
        ],
        defaultValue: 'row',
      },
      {
        key: 'spacing',
        displayName: 'Spacing',
        description: 'Row spacing variant',
        type: 'select',
        required: false,
        options: [
          {
            value: 'default',
            displayName: 'Default',
          },
          {
            value: 'compact',
            displayName: 'Compact',
          },
          {
            value: 'loose',
            displayName: 'Loose',
          },
          {
            value: 'none',
            displayName: 'None',
          },
        ],
        defaultValue: 'default',
      },
      {
        key: 'background',
        displayName: 'Background',
        description: 'Background variant',
        type: 'select',
        required: false,
        options: [
          {
            value: 'default',
            displayName: 'Default',
          },
          {
            value: 'light',
            displayName: 'Light',
          },
          {
            value: 'dark',
            displayName: 'Dark',
          },
          {
            value: 'transparent',
            displayName: 'Transparent',
          },
        ],
        defaultValue: 'default',
      },
    ],
  },
]

export default displayTemplates
