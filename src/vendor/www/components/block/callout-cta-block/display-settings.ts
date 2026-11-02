export default [
  {
    key: 'CalloutCtaBlockDisplayTemplate',
    displayName: 'Callout CTA Display Template',
    contentType: 'CalloutCtaBlock',
    isDefault: true,
    settings: [
      {
        key: 'colorScheme',
        displayName: 'Color Scheme',
        description: 'Background color scheme',
        type: 'select',
        required: false,
        defaultValue: 'pink',
        options: [
          {
            value: 'pink',
            displayName: 'Light pink',
          },
          {
            value: 'blue',
            displayName: 'Light blue',
          },
          {
            value: 'neutral',
            displayName: 'Neutral',
          },
          {
            value: 'darkfir',
            displayName: 'Dark Fir green',
          },
          {
            value: 'green',
            displayName: 'Green',
          },
        ],
      },
    ],
  },
] as const
