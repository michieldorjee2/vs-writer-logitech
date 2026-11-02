const PADDING_OPTIONS = [
  { value: 'none', displayName: 'None (0px)' },
  { value: 'sm', displayName: 'Small (8px)' },
  { value: 'md', displayName: 'Medium (16px)' },
  { value: 'lg', displayName: 'Large (24px)' },
  { value: 'xl', displayName: 'Extra Large (32px)' },
  { value: 'xxl', displayName: '2X Large (48px)' },
] as const

const PADDING_OPTIONS_LG = [
  { value: 'inherit', displayName: 'Inherit' },
  ...PADDING_OPTIONS,
] as const

export default [
  {
    key: 'TextContentElementDisplayTemplate',
    displayName: 'Text content Display Template',
    contentType: 'TextContentElement',
    settings: [
      {
        key: 'colorScheme',
        displayName: 'Color Scheme',
        type: 'select',
        required: false,
        options: [
          {
            value: 'default',
            displayName: 'Default (Inherit)',
          },
          {
            value: 'dark',
            displayName: 'Dark',
          },
          {
            value: 'white',
            displayName: 'White',
          },
          {
            value: 'lfgreen',
            displayName: 'Green',
          },
        ],
        defaultValue: 'default',
      },
      {
        key: 'textStroke',
        displayName: 'Text Stroke',
        type: 'select',
        required: false,
        options: [
          {
            value: 'false',
            displayName: 'Off',
          },
          {
            value: 'true',
            displayName: 'On',
          },
        ],
        defaultValue: 'false',
      },
      {
        key: 'paragraphFontSize',
        displayName: 'Paragraph Font Size',
        type: 'select',
        required: false,
        options: [
          { value: 'default', displayName: 'Default (22px)' },
          { value: 'px_28', displayName: '28px' },
          { value: 'px_22', displayName: '22px' },
          { value: 'px_18', displayName: '18px' },
          { value: 'px_16', displayName: '16px' },
          { value: 'px_14', displayName: '14px' },
          { value: 'px_12', displayName: '12px' },
        ],
        defaultValue: 'default',
      },
      {
        key: 'paragraphFontWeight',
        displayName: 'Paragraph Font Weight',
        type: 'select',
        required: false,
        options: [
          { value: 'default', displayName: 'Default (Regular)' },
          { value: 'medium', displayName: 'Medium' },
          { value: 'bold', displayName: 'Bold' },
        ],
        defaultValue: 'default',
      },
      {
        key: 'paddingTop',
        displayName: 'Padding Top (mobile)',
        type: 'select',
        required: false,
        options: PADDING_OPTIONS,
        defaultValue: 'none',
      },
      {
        key: 'paddingTopLg',
        displayName: 'Padding Top (desktop)',
        type: 'select',
        required: false,
        options: PADDING_OPTIONS_LG,
        defaultValue: 'inherit',
      },
      {
        key: 'paddingRight',
        displayName: 'Padding Right (mobile)',
        type: 'select',
        required: false,
        options: PADDING_OPTIONS,
        defaultValue: 'none',
      },
      {
        key: 'paddingRightLg',
        displayName: 'Padding Right (desktop)',
        type: 'select',
        required: false,
        options: PADDING_OPTIONS_LG,
        defaultValue: 'inherit',
      },
      {
        key: 'paddingBottom',
        displayName: 'Padding Bottom (mobile)',
        type: 'select',
        required: false,
        options: PADDING_OPTIONS,
        defaultValue: 'none',
      },
      {
        key: 'paddingBottomLg',
        displayName: 'Padding Bottom (desktop)',
        type: 'select',
        required: false,
        options: PADDING_OPTIONS_LG,
        defaultValue: 'inherit',
      },
      {
        key: 'paddingLeft',
        displayName: 'Padding Left (mobile)',
        type: 'select',
        required: false,
        options: PADDING_OPTIONS,
        defaultValue: 'none',
      },
      {
        key: 'paddingLeftLg',
        displayName: 'Padding Left (desktop)',
        type: 'select',
        required: false,
        options: PADDING_OPTIONS_LG,
        defaultValue: 'inherit',
      },
      {
        key: 'paddingX',
        displayName: 'Horizontal Padding (mobile)',
        type: 'select',
        required: false,
        options: [
          {
            value: 'none',
            displayName: 'None (0px)',
          },
          {
            value: 'sm',
            displayName: 'Small (8px)',
          },
          {
            value: 'md',
            displayName: 'Medium (16px)',
          },
          {
            value: 'lg',
            displayName: 'Large (24px)',
          },
        ],
        defaultValue: 'none',
      },
      {
        key: 'paddingXMd',
        displayName: 'Horizontal Padding (tablet)',
        type: 'select',
        required: false,
        options: [
          {
            value: 'inherit',
            displayName: 'Inherit',
          },
          {
            value: 'none',
            displayName: 'None (0px)',
          },
          {
            value: 'sm',
            displayName: 'Small (8px)',
          },
          {
            value: 'md',
            displayName: 'Medium (16px)',
          },
          {
            value: 'lg',
            displayName: 'Large (24px)',
          },
        ],
        defaultValue: 'inherit',
      },
      {
        key: 'paddingXLg',
        displayName: 'Horizontal Padding (desktop)',
        type: 'select',
        required: false,
        options: [
          {
            value: 'inherit',
            displayName: 'Inherit',
          },
          {
            value: 'none',
            displayName: 'None (0px)',
          },
          {
            value: 'sm',
            displayName: 'Small (8px)',
          },
          {
            value: 'md',
            displayName: 'Medium (16px)',
          },
          {
            value: 'lg',
            displayName: 'Large (24px)',
          },
        ],
        defaultValue: 'inherit',
      },
    ],
  },
] as const
