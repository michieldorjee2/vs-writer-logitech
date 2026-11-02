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
    key: 'StackedHeadingElementDisplayTemplate',
    displayName: 'Stacked Heading Display Template',
    contentType: 'StackedHeadingElement',
    settings: [
      {
        key: 'colorScheme',
        displayName: 'Color Scheme',
        type: 'select',
        required: false,
        options: [
          {
            value: 'inherit',
            displayName: 'Inherit (from section/row)',
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
        defaultValue: 'inherit',
      },
      {
        key: 'marginBottom',
        displayName: 'Margin Bottom',
        type: 'select',
        required: false,
        options: [
          {
            value: 'none',
            displayName: 'None (0)',
          },
          {
            value: 'xs',
            displayName: 'Extra Small (0.25rem)',
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
          {
            value: 'xl',
            displayName: 'Extra Large (32px)',
          },
          {
            value: 'xxl',
            displayName: '2X Large (48px)',
          },
        ],
        defaultValue: 'xl',
      },
      {
        key: 'animationMode',
        displayName: 'Animation Mode',
        type: 'select',
        required: false,
        options: [
          {
            value: 'none',
            displayName: 'None',
          },
          {
            value: 'scroll',
            displayName: 'Scroll',
          },
          {
            value: 'mouse',
            displayName: 'Mouse',
          },
        ],
        defaultValue: 'none',
      },
      {
        key: 'curvedText',
        displayName: 'Curved Text',
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
        key: 'arcAmount',
        displayName: 'Arc Amount',
        type: 'select',
        required: false,
        options: [
          {
            value: 'arc_10',
            displayName: '10% (Subtle)',
          },
          {
            value: 'arc_20',
            displayName: '20%',
          },
          {
            value: 'arc_30',
            displayName: '30%',
          },
          {
            value: 'arc_40',
            displayName: '40%',
          },
          {
            value: 'arc_50',
            displayName: '50% (Half Circle)',
          },
          {
            value: 'arc_60',
            displayName: '60%',
          },
          {
            value: 'arc_70',
            displayName: '70%',
          },
          {
            value: 'arc_80',
            displayName: '80%',
          },
        ],
        defaultValue: 'arc_30',
      },
      {
        key: 'extrusionCount',
        displayName: 'Extrusion Layers',
        type: 'select',
        required: false,
        options: [
          {
            value: 'layers_5',
            displayName: '5 Layers',
          },
          {
            value: 'layers_6',
            displayName: '6 Layers',
          },
          {
            value: 'layers_7',
            displayName: '7 Layers',
          },
          {
            value: 'layers_8',
            displayName: '8 Layers',
          },
          {
            value: 'layers_9',
            displayName: '9 Layers',
          },
        ],
        defaultValue: 'layers_5',
      },
      {
        key: 'fontFamily',
        displayName: 'Font Family',
        type: 'select',
        required: false,
        options: [
          {
            value: 'nudge',
            displayName: 'VC Nudge',
          },
          {
            value: 'henrietta',
            displayName: 'VC Henrietta Condensed',
          },
        ],
        defaultValue: 'nudge',
      },
      {
        key: 'fontSizeMobile',
        displayName: 'Font Size (Mobile)',
        type: 'select',
        required: false,
        options: [
          {
            value: 'default',
            displayName: 'Default',
          },
          {
            value: 'text_4xl',
            displayName: 'Heading 3 (28px)',
          },
          {
            value: 'text_5xl',
            displayName: '32px',
          },
          {
            value: 'text_6xl',
            displayName: 'Heading 2 (36px)',
          },
          {
            value: 'text_7xl',
            displayName: '40px',
          },
          {
            value: 'text_8xl',
            displayName: 'Heading 1 (48px)',
          },
          {
            value: 'text_9xl',
            displayName: '56px',
          },
          {
            value: 'text_10xl',
            displayName: 'Heading 2 lg (64px)',
          },
          {
            value: 'text_11xl',
            displayName: '70px',
          },
          {
            value: 'text_12xl',
            displayName: 'Heading 1 lg (88px)',
          },
          {
            value: 'text_13xl',
            displayName: '96px',
          },
          {
            value: 'text_14xl',
            displayName: '120px',
          },
          {
            value: 'text_14_5xl',
            displayName: '140px',
          },
          {
            value: 'text_15xl',
            displayName: '160px',
          },
        ],
        defaultValue: 'default',
      },
      {
        key: 'fontSizeMd',
        displayName: 'Font Size (md breakpoint)',
        type: 'select',
        required: false,
        options: [
          {
            value: 'default',
            displayName: 'Default',
          },
          {
            value: 'md_text_4xl',
            displayName: 'Heading 3 (28px)',
          },
          {
            value: 'md_text_5xl',
            displayName: '32px',
          },
          {
            value: 'md_text_6xl',
            displayName: 'Heading 2 (36px)',
          },
          {
            value: 'md_text_7xl',
            displayName: '40px',
          },
          {
            value: 'md_text_8xl',
            displayName: 'Heading 1 (48px)',
          },
          {
            value: 'md_text_9xl',
            displayName: '56px',
          },
          {
            value: 'md_text_10xl',
            displayName: 'Heading 2 lg (64px)',
          },
          {
            value: 'md_text_11xl',
            displayName: '70px',
          },
          {
            value: 'md_text_12xl',
            displayName: 'Heading 1 lg (88px)',
          },
          {
            value: 'md_text_13xl',
            displayName: '96px',
          },
          {
            value: 'md_text_14xl',
            displayName: '120px',
          },
          {
            value: 'md_text_14_5xl',
            displayName: '140px',
          },
          {
            value: 'md_text_15xl',
            displayName: '160px',
          },
        ],
        defaultValue: 'default',
      },
      {
        key: 'fontSizeLg',
        displayName: 'Font Size (lg breakpoint)',
        type: 'select',
        required: false,
        options: [
          {
            value: 'default',
            displayName: 'Default',
          },
          {
            value: 'lg_text_4xl',
            displayName: 'Heading 3 (28px)',
          },
          {
            value: 'lg_text_5xl',
            displayName: '32px',
          },
          {
            value: 'lg_text_6xl',
            displayName: 'Heading 2 (36px)',
          },
          {
            value: 'lg_text_7xl',
            displayName: '40px',
          },
          {
            value: 'lg_text_8xl',
            displayName: 'Heading 1 (48px)',
          },
          {
            value: 'lg_text_9xl',
            displayName: '56px',
          },
          {
            value: 'lg_text_10xl',
            displayName: 'Heading 2 lg (64px)',
          },
          {
            value: 'lg_text_11xl',
            displayName: '70px',
          },
          {
            value: 'lg_text_12xl',
            displayName: 'Heading 1 lg (88px)',
          },
          {
            value: 'lg_text_13xl',
            displayName: '96px',
          },
          {
            value: 'lg_text_14xl',
            displayName: '120px',
          },
          {
            value: 'lg_text_14_5xl',
            displayName: '140px',
          },
          {
            value: 'lg_text_15xl',
            displayName: '160px',
          },
        ],
        defaultValue: 'default',
      },
      {
        key: 'fontSize2xl',
        displayName: 'Font Size (2xl breakpoint)',
        type: 'select',
        required: false,
        options: [
          {
            value: 'default',
            displayName: 'Default',
          },
          {
            value: 'xxl_text_4xl',
            displayName: 'Heading 3 (28px)',
          },
          {
            value: 'xxl_text_5xl',
            displayName: '32px',
          },
          {
            value: 'xxl_text_6xl',
            displayName: 'Heading 2 (36px)',
          },
          {
            value: 'xxl_text_7xl',
            displayName: '40px',
          },
          {
            value: 'xxl_text_8xl',
            displayName: 'Heading 1 (48px)',
          },
          {
            value: 'xxl_text_9xl',
            displayName: '56px',
          },
          {
            value: 'xxl_text_10xl',
            displayName: 'Heading 2 lg (64px)',
          },
          {
            value: 'xxl_text_11xl',
            displayName: '70px',
          },
          {
            value: 'xxl_text_12xl',
            displayName: 'Heading 1 lg (88px)',
          },
          {
            value: 'xxl_text_13xl',
            displayName: '96px',
          },
          {
            value: 'xxl_text_14xl',
            displayName: '120px',
          },
          {
            value: 'xxl_text_14_5xl',
            displayName: '140px',
          },
          {
            value: 'xxl_text_15xl',
            displayName: '160px',
          },
        ],
        defaultValue: 'default',
      },
      {
        key: 'alignment',
        displayName: 'Alignment (text, horizontal)',
        type: 'select',
        required: false,
        options: [
          {
            value: 'left',
            displayName: 'Left',
          },
          {
            value: 'center',
            displayName: 'Center',
          },
          {
            value: 'right',
            displayName: 'Right',
          },
        ],
        defaultValue: 'left',
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
    ],
    isDefault: true,
  },
] as const
