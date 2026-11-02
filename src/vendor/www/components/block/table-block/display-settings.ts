export default [
  {
    key: 'TableBlockDisplayTemplate',
    displayName: 'Table Block Display Template',
    contentType: 'TableBlock',
    isDefault: true,
    settings: [
      {
        key: 'tableVariant',
        displayName: 'Table Variant',
        type: 'select',
        options: [
          {
            value: 'dark',
            displayName: 'Dark (default for light sections)',
          },
          {
            value: 'light',
            displayName: 'Light (for dark sections)',
          },
        ],
        defaultValue: 'dark',
      },
    ],
  },
] as const
