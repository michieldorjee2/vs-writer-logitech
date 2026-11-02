export default [
  {
    key: 'CarouselLogosDisplayTemplate',
    displayName: 'Carousel Logos Display Template',
    contentType: 'CarouselLogos',
    isDefault: true,
    settings: [
      {
        key: 'colorScheme',
        displayName: 'Color Scheme',
        type: 'select',
        required: false,
        defaultValue: 'light',
        options: [
          { value: 'light', displayName: 'Light' },
          { value: 'dark', displayName: 'Dark' },
        ],
      },
      {
        key: 'scrollDirection',
        displayName: 'Scroll Direction',
        type: 'select',
        required: false,
        defaultValue: 'left',
        options: [
          { value: 'left', displayName: 'Left' },
          { value: 'right', displayName: 'Right' },
        ],
      },
      {
        key: 'cardSize',
        displayName: 'Card Size',
        type: 'select',
        required: false,
        defaultValue: 'regular',
        options: [
          { value: 'small', displayName: 'Small' },
          { value: 'regular', displayName: 'Regular' },
        ],
      },
    ],
  },
] as const
