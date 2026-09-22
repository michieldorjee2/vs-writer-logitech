export default [
  {
    key: 'IconElementDisplayTemplate',
    displayName: 'Icon Display Template',
    contentType: 'IconElement',
    settings: [
      {
        key: 'size',
        displayName: 'Size',
        type: 'select',
        required: false,
        options: [
          { value: 'small', displayName: 'Small' },
          { value: 'medium', displayName: 'Medium' },
          { value: 'large', displayName: 'Large' },
        ],
        defaultValue: 'small',
      },
      {
        key: 'weight',
        displayName: 'Weight',
        type: 'select',
        required: false,
        options: [
          { value: 'light', displayName: 'Light' },
          { value: 'regular', displayName: 'Regular' },
          { value: 'bold', displayName: 'Bold' },
        ],
        defaultValue: 'regular',
      },
      {
        key: 'fill',
        displayName: 'Fill',
        type: 'select',
        required: false,
        options: [
          { value: 'outlined', displayName: 'Outlined' },
          { value: 'filled', displayName: 'Filled' },
        ],
        defaultValue: 'outlined',
      },
      {
        key: 'color',
        displayName: 'Color',
        type: 'select',
        required: false,
        options: [
          { value: 'inherit', displayName: 'Inherit' },
          { value: 'darkfir', displayName: 'Dark Fir' },
          { value: 'white', displayName: 'White' },
          { value: 'green', displayName: 'Green' },
          { value: 'ltblue', displayName: 'Light Blue' },
          { value: 'pink', displayName: 'Pink' },
        ],
        defaultValue: 'inherit',
      },
    ],
    isDefault: true,
  },
] as const
