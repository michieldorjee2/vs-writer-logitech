export default [
  {
    displayName: 'Column Display Template',
    hasDisplayTypes: true,
    hasDirectory: true,
    hasComponent: true,
    isVisualBuilderEnabled: true,
    inCMS: false,
    isDefault: true,
    key: 'ColumnDisplayTemplate',
    description: 'Display template for Visual Builder columns',
    nodeType: 'column',
    settings: [
      {
        key: 'colSpan',
        displayName: 'Column Span',
        description: 'Number of columns to span in grid layout',
        type: 'select',
        required: false,
        options: [
          {
            value: 'auto',
            displayName: 'Auto',
          },
          {
            value: 'full',
            displayName: 'Full (span all)',
          },
          {
            value: 'span_1',
            displayName: 'Span 1',
          },
          {
            value: 'span_2',
            displayName: 'Span 2',
          },
          {
            value: 'span_3',
            displayName: 'Span 3',
          },
          {
            value: 'span_4',
            displayName: 'Span 4',
          },
          {
            value: 'span_5',
            displayName: 'Span 5',
          },
          {
            value: 'span_6',
            displayName: 'Span 6',
          },
          {
            value: 'span_7',
            displayName: 'Span 7',
          },
          {
            value: 'span_8',
            displayName: 'Span 8',
          },
          {
            value: 'span_9',
            displayName: 'Span 9',
          },
          {
            value: 'span_10',
            displayName: 'Span 10',
          },
          {
            value: 'span_11',
            displayName: 'Span 11',
          },
          {
            value: 'span_12',
            displayName: 'Span 12',
          },
        ],
        defaultValue: 'auto',
      },
      {
        key: 'colStart',
        displayName: 'Column Start',
        description: 'Starting column grid line',
        type: 'select',
        required: false,
        options: [
          {
            value: 'auto',
            displayName: 'Auto',
          },
          {
            value: 'start_1',
            displayName: 'Line 1',
          },
          {
            value: 'start_2',
            displayName: 'Line 2',
          },
          {
            value: 'start_3',
            displayName: 'Line 3',
          },
          {
            value: 'start_4',
            displayName: 'Line 4',
          },
          {
            value: 'start_5',
            displayName: 'Line 5',
          },
          {
            value: 'start_6',
            displayName: 'Line 6',
          },
          {
            value: 'start_7',
            displayName: 'Line 7',
          },
          {
            value: 'start_8',
            displayName: 'Line 8',
          },
          {
            value: 'start_9',
            displayName: 'Line 9',
          },
          {
            value: 'start_10',
            displayName: 'Line 10',
          },
          {
            value: 'start_11',
            displayName: 'Line 11',
          },
          {
            value: 'start_12',
            displayName: 'Line 12',
          },
          {
            value: 'start_13',
            displayName: 'Line 13',
          },
        ],
      },
      {
        key: 'colEnd',
        displayName: 'Column End',
        description: 'Ending column grid line',
        type: 'select',
        required: false,
        options: [
          {
            value: 'auto',
            displayName: 'Auto',
          },
          {
            value: 'end_1',
            displayName: 'Line 1',
          },
          {
            value: 'end_2',
            displayName: 'Line 2',
          },
          {
            value: 'end_3',
            displayName: 'Line 3',
          },
          {
            value: 'end_4',
            displayName: 'Line 4',
          },
          {
            value: 'end_5',
            displayName: 'Line 5',
          },
          {
            value: 'end_6',
            displayName: 'Line 6',
          },
          {
            value: 'end_7',
            displayName: 'Line 7',
          },
          {
            value: 'end_8',
            displayName: 'Line 8',
          },
          {
            value: 'end_9',
            displayName: 'Line 9',
          },
          {
            value: 'end_10',
            displayName: 'Line 10',
          },
          {
            value: 'end_11',
            displayName: 'Line 11',
          },
          {
            value: 'end_12',
            displayName: 'Line 12',
          },
          {
            value: 'end_13',
            displayName: 'Line 13',
          },
        ],
      },
      {
        key: 'rowSpan',
        displayName: 'Row Span',
        description: 'Number of rows to span in grid layout',
        type: 'select',
        required: false,
        options: [
          {
            value: 'auto',
            displayName: 'Auto',
          },
          {
            value: 'full',
            displayName: 'Full (span all)',
          },
          {
            value: 'row_span_1',
            displayName: 'Span 1',
          },
          {
            value: 'row_span_2',
            displayName: 'Span 2',
          },
          {
            value: 'row_span_3',
            displayName: 'Span 3',
          },
          {
            value: 'row_span_4',
            displayName: 'Span 4',
          },
          {
            value: 'row_span_5',
            displayName: 'Span 5',
          },
          {
            value: 'row_span_6',
            displayName: 'Span 6',
          },
        ],
      },
      {
        key: 'rowStart',
        displayName: 'Row Start',
        description: 'Starting row grid line',
        type: 'select',
        required: false,
        options: [
          {
            value: 'auto',
            displayName: 'Auto',
          },
          {
            value: 'row_start_1',
            displayName: 'Line 1',
          },
          {
            value: 'row_start_2',
            displayName: 'Line 2',
          },
          {
            value: 'row_start_3',
            displayName: 'Line 3',
          },
          {
            value: 'row_start_4',
            displayName: 'Line 4',
          },
          {
            value: 'row_start_5',
            displayName: 'Line 5',
          },
          {
            value: 'row_start_6',
            displayName: 'Line 6',
          },
          {
            value: 'row_start_7',
            displayName: 'Line 7',
          },
        ],
      },
      {
        key: 'rowEnd',
        displayName: 'Row End',
        description: 'Ending row grid line',
        type: 'select',
        required: false,
        options: [
          {
            value: 'auto',
            displayName: 'Auto',
          },
          {
            value: 'row_end_1',
            displayName: 'Line 1',
          },
          {
            value: 'row_end_2',
            displayName: 'Line 2',
          },
          {
            value: 'row_end_3',
            displayName: 'Line 3',
          },
          {
            value: 'row_end_4',
            displayName: 'Line 4',
          },
          {
            value: 'row_end_5',
            displayName: 'Line 5',
          },
          {
            value: 'row_end_6',
            displayName: 'Line 6',
          },
          {
            value: 'row_end_7',
            displayName: 'Line 7',
          },
        ],
      },
      {
        key: 'justifySelf',
        displayName: 'Justify Self',
        description: 'Horizontal alignment of this column',
        type: 'select',
        required: false,
        options: [
          {
            value: 'auto',
            displayName: 'Auto',
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
            value: 'stretch',
            displayName: 'Stretch',
          },
        ],
      },
      {
        key: 'alignSelf',
        displayName: 'Align Self',
        description: 'Vertical alignment of this column',
        type: 'select',
        required: false,
        options: [
          {
            value: 'auto',
            displayName: 'Auto',
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
            value: 'stretch',
            displayName: 'Stretch',
          },
          {
            value: 'baseline',
            displayName: 'Baseline',
          },
        ],
      },
      {
        key: 'order',
        displayName: 'Order',
        description: 'Visual order in layout',
        type: 'select',
        required: false,
        options: [
          {
            value: 'none',
            displayName: 'Default (None)',
          },
          {
            value: 'first',
            displayName: 'First',
          },
          {
            value: 'last',
            displayName: 'Last',
          },
          {
            value: 'order_1',
            displayName: '1',
          },
          {
            value: 'order_2',
            displayName: '2',
          },
          {
            value: 'order_3',
            displayName: '3',
          },
          {
            value: 'order_4',
            displayName: '4',
          },
          {
            value: 'order_5',
            displayName: '5',
          },
          {
            value: 'order_6',
            displayName: '6',
          },
          {
            value: 'order_7',
            displayName: '7',
          },
          {
            value: 'order_8',
            displayName: '8',
          },
          {
            value: 'order_9',
            displayName: '9',
          },
          {
            value: 'order_10',
            displayName: '10',
          },
          {
            value: 'order_11',
            displayName: '11',
          },
          {
            value: 'order_12',
            displayName: '12',
          },
        ],
      },
      {
        key: 'displayMode',
        displayName: 'Display Mode',
        description: 'Layout mode for this column\'s own children',
        type: 'select',
        required: false,
        options: [
          {
            value: 'flex',
            displayName: 'Flex',
          },
          {
            value: 'grid',
            displayName: 'Grid',
          },
        ],
        defaultValue: 'flex',
      },
      {
        key: 'gridColumns',
        displayName: 'Grid Columns',
        description: 'Number of columns in this column\'s own grid (base/sm breakpoint), when Display Mode is Grid',
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
        description: 'Number of columns at md breakpoint and above, when Display Mode is Grid',
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
        description: 'Number of columns at lg breakpoint and above, when Display Mode is Grid',
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
        description: 'Number of columns at xl breakpoint and above, when Display Mode is Grid',
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
        key: 'gap',
        displayName: 'Gap',
        description: 'Spacing between this column\'s own child items',
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
        defaultValue: 'none',
      },
    ],
  },
] as const
