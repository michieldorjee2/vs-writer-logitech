export default [
  {
    key: 'BlankSectionDisplayTemplate',
    displayName: 'Blank Section Display Template',
    contentType: 'BlankSection',
    isDefault: true,
    created: '2025-09-16T21:07:31.9373909+00:00',
    createdBy: '04230db21acf4c678c2863685fb1fbeb',
    lastModified: '2025-09-16T21:07:31.9373909+00:00',
    lastModifiedBy: '04230db21acf4c678c2863685fb1fbeb',
    settings: [
      {
        key: 'containerWidth',
        displayName: 'Container Width',
        type: 'select',
        options: [
          {
            value: 'full',
            displayName: 'Full Width',
          },
          {
            value: 'contained',
            displayName: 'Contained (max-width)',
          },
          {
            value: 'contained_bg',
            displayName: 'Contained with Background',
          },
        ],
        defaultValue: 'full',
      },
      {
        key: 'backgroundColor',
        displayName: 'Background Color',
        type: 'select',
        options: [
          {
            value: 'transparent',
            displayName: 'Transparent',
          },
          {
            value: 'white',
            displayName: 'White',
          },
          {
            value: 'light_gray',
            displayName: 'Light Gray',
          },
          {
            value: 'light_green',
            displayName: 'Light Forest Green',
          },
          {
            value: 'light_teal',
            displayName: 'Light Teal',
          },
          {
            value: 'dark_forest',
            displayName: 'Dark Forest',
          },
        ],
        defaultValue: 'transparent',
      },
      {
        key: 'paddingY',
        displayName: 'Vertical Padding',
        type: 'select',
        options: [
          {
            value: 'none',
            displayName: 'None (0px)',
          },
          {
            value: 'compact',
            displayName: 'Compact (16px)',
          },
          {
            value: 'default',
            displayName: 'Default (32px)',
          },
          {
            value: 'loose',
            displayName: 'Loose (64px)',
          },
          {
            value: 'extra_loose',
            displayName: 'Extra Loose (96px)',
          },
        ],
        defaultValue: 'default',
      },
      {
        key: 'paddingX',
        displayName: 'Horizontal Padding',
        type: 'select',
        options: [
          {
            value: 'none',
            displayName: 'None (0px)',
          },
          {
            value: 'compact',
            displayName: 'Compact (16px)',
          },
          {
            value: 'default',
            displayName: 'Default (32px)',
          },
          {
            value: 'loose',
            displayName: 'Loose (64px)',
          },
        ],
        defaultValue: 'default',
      },
      {
        key: 'roundedCorners',
        displayName: 'Rounded Corners',
        type: 'select',
        options: [
          {
            value: 'all',
            displayName: 'All Corners',
          },
          {
            value: 'top',
            displayName: 'Top Only',
          },
          {
            value: 'bottom',
            displayName: 'Bottom Only',
          },
          {
            value: 'none',
            displayName: 'None',
          },
        ],
        defaultValue: 'all',
      },
      {
        key: 'marginTop',
        displayName: 'Margin Top',
        type: 'select',
        options: [
          {
            value: 'negative_lg',
            displayName: 'Negative Large (-40px)',
          },
          {
            value: 'negative_md',
            displayName: 'Negative Medium (-24px)',
          },
          {
            value: 'negative_sm',
            displayName: 'Negative Small (-16px)',
          },
          {
            value: 'none',
            displayName: 'None (0px)',
          },
          {
            value: 'sm',
            displayName: 'Small (16px)',
          },
          {
            value: 'md',
            displayName: 'Medium (24px)',
          },
          {
            value: 'lg',
            displayName: 'Large (32px)',
          },
          {
            value: 'xl',
            displayName: 'Extra Large (48px)',
          },
          {
            value: 'm_2xl',
            displayName: '2X Large (64px)',
          },
          {
            value: 'm_3xl',
            displayName: '3X Large (96px)',
          },
          {
            value: 'm_4xl',
            displayName: '4X Large (128px)',
          },
        ],
        defaultValue: 'none',
      },
      {
        key: 'marginBottom',
        displayName: 'Margin Bottom',
        type: 'select',
        options: [
          {
            value: 'negative_lg',
            displayName: 'Negative Large (-40px)',
          },
          {
            value: 'negative_md',
            displayName: 'Negative Medium (-24px)',
          },
          {
            value: 'negative_sm',
            displayName: 'Negative Small (-16px)',
          },
          {
            value: 'none',
            displayName: 'None (0px)',
          },
          {
            value: 'sm',
            displayName: 'Small (16px)',
          },
          {
            value: 'md',
            displayName: 'Medium (24px)',
          },
          {
            value: 'lg',
            displayName: 'Large (32px)',
          },
          {
            value: 'xl',
            displayName: 'Extra Large (48px)',
          },
          {
            value: 'm_2xl',
            displayName: '2X Large (64px)',
          },
          {
            value: 'm_3xl',
            displayName: '3X Large (96px)',
          },
          {
            value: 'm_4xl',
            displayName: '4X Large (128px)',
          },
        ],
        defaultValue: 'none',
      },
    ],
  },
] as const
