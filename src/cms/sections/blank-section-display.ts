/**
 * Display template for `BlankSection` — the one section type every Limitless page is built
 * from.
 *
 * SEVEN of the eight settings below are optimizely.com's own, copied verbatim from
 * `components/section/blank-section/display-settings.ts` in the corporate site's codebase:
 * `containerWidth`, `backgroundColor`, `paddingY`, `paddingX`, `roundedCorners`,
 * `marginTop`, `marginBottom`. Reusing that vocabulary unchanged is how a Showcase page
 * inherits the corporate site's rhythm rather than approximating it: the same six background
 * colours, the same padding ladder, the same negative-margin values. A section authored here
 * and a section authored on optimizely.com mean the same thing by `paddingY: 'loose'`.
 *
 * THE EIGHTH, `backgroundTreatment`, is ours, and it is a deliberate seam. Limitless's
 * distinctive hero — the gradient galaxy, and the extruded green of the ROI band — is a
 * PAINTING CHOICE on the shared section, not a forked section type. Had it been a type
 * (`LimitlessHeroSection`), every later change to optimizely.com's section vocabulary would
 * have to be ported twice, the two types would drift, and an editor moving content between
 * them would lose their settings. As a display setting it costs one enum, it is visible and
 * changeable in Visual Builder, and the section type stays the corporate one.
 *
 * Upstream's `hasDisplayTypes`, `hasDirectory`, `hasComponent`, `isVisualBuilderEnabled` and
 * `inCMS` flags are deliberately absent: they are outside the canonical repo shape this repo
 * round-trips (see `normalizeRepoDisplayTemplate`), and so are upstream's `created` /
 * `lastModified` audit fields, which the server assigns.
 *
 * `defaultValue` has no CMS equivalent. Defaults live here and are applied client-side at
 * compose time by `extractDefaults()`, which is why the blueprints store only the settings
 * that DEVIATE from these.
 *
 * NOTE ON DISCOVERY: `registry.ts` globs the component folders, `experiences/*.ts` and
 * `blueprints/*.ts` — not `sections/`. Until it also globs this directory, `apply.ts` will
 * not push this template, and a composition that sets these keys is writing settings the CMS
 * has no template for. Push it before instantiating a page.
 */
import type { RepoDisplayTemplate } from '../display-template-transform'

const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'BlankSectionDisplayTemplate',
    displayName: 'Blank Section Display Template',
    contentType: 'BlankSection',
    isDefault: true,
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
      {
        key: 'backgroundTreatment',
        displayName: 'Background Treatment',
        description:
          "How the section paints itself behind its content. 'plain' is optimizely.com's own " +
          'flat band; the other two are the Limitless look.',
        type: 'select',
        required: false,
        options: [
          { value: 'plain', displayName: 'Plain (flat colour)' },
          { value: 'gradient_galaxy', displayName: 'Gradient galaxy' },
          { value: 'extrusion', displayName: 'Extrusion' },
        ],
        defaultValue: 'plain',
      },
    ],
  },
]

export default displayTemplates
