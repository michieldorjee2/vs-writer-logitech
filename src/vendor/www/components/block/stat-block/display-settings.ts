export default [
  {
    key: 'StatBlockDisplayTemplate',
    displayName: 'Stat Block Display Template',
    contentType: 'StatBlock',
    isDefault: true,
    settings: [
      {
        key: 'alignment',
        displayName: 'Alignment (stack orientation)',
        type: 'select',
        required: false,
        options: [
          { value: 'vertical', displayName: 'Vertical' },
          { value: 'horizontal', displayName: 'Horizontal' },
        ],
        defaultValue: 'vertical',
      },
      {
        key: 'heightSpan',
        displayName: 'Height Span',
        type: 'select',
        required: false,
        options: [
          { value: 'false', displayName: 'Auto' },
          { value: 'true', displayName: 'Fill Column' },
        ],
        defaultValue: 'false',
      },
      {
        key: 'animationMode',
        displayName: 'Animation Mode',
        type: 'select',
        required: false,
        options: [
          { value: 'none', displayName: 'None' },
          { value: 'scroll', displayName: 'Scroll' },
          { value: 'mouse', displayName: 'Mouse' },
        ],
        defaultValue: 'none',
      },
      {
        key: 'extrusionCount',
        displayName: 'Extrusion Layers',
        type: 'select',
        required: false,
        options: [
          { value: 'layers_5', displayName: '5 Layers' },
          { value: 'layers_6', displayName: '6 Layers' },
          { value: 'layers_7', displayName: '7 Layers' },
          { value: 'layers_8', displayName: '8 Layers' },
          { value: 'layers_9', displayName: '9 Layers' },
        ],
        defaultValue: 'layers_5',
      },
    ],
  },
] as const
