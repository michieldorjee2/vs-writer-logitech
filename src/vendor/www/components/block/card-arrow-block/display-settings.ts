export default [
  {
    key: 'CardArrowBlockDisplayTemplate',
    displayName: 'Card Arrow Display Template',
    contentType: 'CardArrowBlock',
    isDefault: true,
    settings: [
      {
        key: 'colorScheme',
        displayName: 'Color Scheme',
        type: 'select',
        required: false,
        options: [
          { value: 'darkGreen', displayName: 'Dark fir green' },
          { value: 'neutral', displayName: 'Neutral' },
          { value: 'white', displayName: 'White' },
          { value: 'pink', displayName: 'Light pink' },
          { value: 'blue', displayName: 'Light blue' },
          { value: 'green', displayName: 'Green' },
        ],
        defaultValue: 'darkGreen',
      },
      {
        key: 'disableFullHeight',
        displayName: 'Disable full height',
        type: 'boolean',
        required: false,
        defaultValue: 'false',
      },
    ],
  },
] as const
