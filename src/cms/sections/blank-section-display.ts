/**
 * GENERATED from optimizely.com PROD's live `BlankSectionDisplayTemplate` by scripts/sync-prod-layout-templates.ts.
 * Do not hand-edit — re-run the script. Rendered by src/cms/layout-prod, whose class maps come
 * from the same prod source. 44 settings.
 */
import type { RepoDisplayTemplate } from '../display-template-transform'

const displayTemplates: RepoDisplayTemplate[] = [{
  "key": "BlankSectionDisplayTemplate",
  "displayName": "Blank Section Display Template",
  "contentType": "BlankSection",
  "isDefault": true,
  "settings": [
    {
      "key": "containerWidth",
      "displayName": "Container Width",
      "type": "select",
      "options": [
        {
          "value": "contained",
          "displayName": "Contained (max-width)"
        },
        {
          "value": "full",
          "displayName": "Full Width"
        },
        {
          "value": "contained_bg",
          "displayName": "Contained with Background"
        }
      ],
      "defaultValue": "full"
    },
    {
      "key": "backgroundColor",
      "displayName": "Background Color",
      "type": "select",
      "options": [
        {
          "value": "transparent",
          "displayName": "Transparent"
        },
        {
          "value": "white",
          "displayName": "White"
        },
        {
          "value": "neutral",
          "displayName": "Neutral"
        },
        {
          "value": "mid_neutral",
          "displayName": "Mid neutral"
        },
        {
          "value": "dark_forest",
          "displayName": "Dark fir green"
        },
        {
          "value": "mid_dark_green",
          "displayName": "Mid fir green"
        },
        {
          "value": "light_dark_green",
          "displayName": "Light fir green"
        },
        {
          "value": "green",
          "displayName": "Green"
        },
        {
          "value": "mid_green",
          "displayName": "Mid green (Grass)"
        },
        {
          "value": "dark_green",
          "displayName": "Dark green (Good2Go)"
        },
        {
          "value": "light_blue",
          "displayName": "Light blue"
        },
        {
          "value": "dark_blue",
          "displayName": "Dark blue"
        },
        {
          "value": "light_pink",
          "displayName": "Light pink"
        },
        {
          "value": "dark_pink",
          "displayName": "Dark pink"
        }
      ],
      "defaultValue": "transparent"
    },
    {
      "key": "secondaryBackgroundColor",
      "displayName": "Secondary Background Color (outer)",
      "type": "select",
      "options": [
        {
          "value": "none",
          "displayName": "None"
        },
        {
          "value": "transparent",
          "displayName": "Transparent"
        },
        {
          "value": "white",
          "displayName": "White"
        },
        {
          "value": "neutral",
          "displayName": "Neutral"
        },
        {
          "value": "mid_neutral",
          "displayName": "Mid neutral"
        },
        {
          "value": "dark_forest",
          "displayName": "Dark fir green"
        },
        {
          "value": "mid_dark_green",
          "displayName": "Mid fir green"
        },
        {
          "value": "light_dark_green",
          "displayName": "Light fir green"
        },
        {
          "value": "green",
          "displayName": "Green"
        },
        {
          "value": "mid_green",
          "displayName": "Mid green (Grass)"
        },
        {
          "value": "dark_green",
          "displayName": "Dark green (Good2Go)"
        },
        {
          "value": "light_blue",
          "displayName": "Light blue"
        },
        {
          "value": "dark_blue",
          "displayName": "Dark blue"
        },
        {
          "value": "light_pink",
          "displayName": "Light pink"
        },
        {
          "value": "dark_pink",
          "displayName": "Dark pink"
        }
      ],
      "defaultValue": "none"
    },
    {
      "key": "fadeBackgroundTop",
      "displayName": "Fade Background Top",
      "type": "checkbox",
      "defaultValue": false
    },
    {
      "key": "fadeBackgroundBottom",
      "displayName": "Fade Background Bottom",
      "type": "checkbox",
      "defaultValue": false
    },
    {
      "key": "paddingTop",
      "displayName": "Padding Top",
      "type": "select",
      "options": [
        {
          "value": "px_80",
          "displayName": "Medium (80px)"
        },
        {
          "value": "none",
          "displayName": "None (0px)"
        },
        {
          "value": "compact",
          "displayName": "X-Small (16px)"
        },
        {
          "value": "default",
          "displayName": "Default (32px)"
        },
        {
          "value": "pt_48",
          "displayName": "Smaller (48px)"
        },
        {
          "value": "loose",
          "displayName": "Small (64px)"
        },
        {
          "value": "extra_loose",
          "displayName": "Large (96px)"
        },
        {
          "value": "xxl",
          "displayName": "XXL (128px)"
        },
        {
          "value": "p_3xl",
          "displayName": "3X Large (144px)"
        },
        {
          "value": "p_4xl",
          "displayName": "4X Large (168px)"
        }
      ],
      "defaultValue": "px_80"
    },
    {
      "key": "paddingTopLg",
      "displayName": "Padding Top - Desktop (lg 1024px)",
      "type": "select",
      "options": [
        {
          "value": "xxl",
          "displayName": "XXL (128px)"
        },
        {
          "value": "inherit",
          "displayName": "Inherit"
        },
        {
          "value": "none",
          "displayName": "None (0px)"
        },
        {
          "value": "compact",
          "displayName": "X-Small (16px)"
        },
        {
          "value": "default",
          "displayName": "Default (32px)"
        },
        {
          "value": "pt_48",
          "displayName": "Smaller (48px)"
        },
        {
          "value": "loose",
          "displayName": "Small (64px)"
        },
        {
          "value": "px_80",
          "displayName": "Medium (80px)"
        },
        {
          "value": "extra_loose",
          "displayName": "Large (96px)"
        },
        {
          "value": "p_3xl",
          "displayName": "3X Large (144px)"
        },
        {
          "value": "p_4xl",
          "displayName": "4X Large (168px)"
        }
      ],
      "defaultValue": "inherit"
    },
    {
      "key": "paddingTopMd",
      "displayName": "Padding Top - Tablet (md 768px)",
      "type": "select",
      "options": [
        {
          "value": "inherit",
          "displayName": "Inherit"
        },
        {
          "value": "none",
          "displayName": "None (0px)"
        },
        {
          "value": "compact",
          "displayName": "X-Small (16px)"
        },
        {
          "value": "pt_48",
          "displayName": "Smaller (48px)"
        },
        {
          "value": "default",
          "displayName": "Default (32px)"
        },
        {
          "value": "loose",
          "displayName": "Small (64px)"
        },
        {
          "value": "px_80",
          "displayName": "Medium (80px)"
        },
        {
          "value": "extra_loose",
          "displayName": "Large (96px)"
        },
        {
          "value": "p_3xl",
          "displayName": "3X Large (144px)"
        },
        {
          "value": "p_4xl",
          "displayName": "4X Large (168px)"
        },
        {
          "value": "xxl",
          "displayName": "XXL (128px)"
        }
      ],
      "defaultValue": "inherit"
    },
    {
      "key": "paddingBottom",
      "displayName": "Padding Bottom",
      "type": "select",
      "options": [
        {
          "value": "px_108",
          "displayName": "108px"
        },
        {
          "value": "none",
          "displayName": "None (0px)"
        },
        {
          "value": "compact",
          "displayName": "Compact (16px)"
        },
        {
          "value": "default",
          "displayName": "Default (32px)"
        },
        {
          "value": "px_40",
          "displayName": "40px"
        },
        {
          "value": "pb_48",
          "displayName": "Smaller (48px)"
        },
        {
          "value": "loose",
          "displayName": "Loose (64px)"
        },
        {
          "value": "extra_loose",
          "displayName": "Extra Loose (96px)"
        },
        {
          "value": "xxl",
          "displayName": "XXL (128px)"
        },
        {
          "value": "px_168",
          "displayName": "168px"
        }
      ],
      "defaultValue": "px_108"
    },
    {
      "key": "paddingBottomLg",
      "displayName": "Padding Bottom - Desktop (lg 1024px)",
      "type": "select",
      "options": [
        {
          "value": "px_168",
          "displayName": "168px"
        },
        {
          "value": "inherit",
          "displayName": "Inherit"
        },
        {
          "value": "none",
          "displayName": "None (0px)"
        },
        {
          "value": "compact",
          "displayName": "Compact (16px)"
        },
        {
          "value": "default",
          "displayName": "Default (32px)"
        },
        {
          "value": "px_40",
          "displayName": "40px"
        },
        {
          "value": "pb_48",
          "displayName": "Smaller (48px)"
        },
        {
          "value": "loose",
          "displayName": "Loose (64px)"
        },
        {
          "value": "extra_loose",
          "displayName": "Extra Loose (96px)"
        },
        {
          "value": "px_108",
          "displayName": "108px"
        },
        {
          "value": "xxl",
          "displayName": "XXL (128px)"
        }
      ],
      "defaultValue": "inherit"
    },
    {
      "key": "paddingBottomMd",
      "displayName": "Padding Bottom - Tablet (md 768px)",
      "type": "select",
      "options": [
        {
          "value": "inherit",
          "displayName": "Inherit"
        },
        {
          "value": "none",
          "displayName": "None (0px)"
        },
        {
          "value": "compact",
          "displayName": "Compact (16px)"
        },
        {
          "value": "default",
          "displayName": "Default (32px)"
        },
        {
          "value": "px_40",
          "displayName": "40px"
        },
        {
          "value": "pb_48",
          "displayName": "Smaller (48px)"
        },
        {
          "value": "loose",
          "displayName": "Loose (64px)"
        },
        {
          "value": "extra_loose",
          "displayName": "Extra Loose (96px)"
        },
        {
          "value": "px_108",
          "displayName": "108px"
        },
        {
          "value": "xxl",
          "displayName": "XXL (128px)"
        },
        {
          "value": "px_168",
          "displayName": "168px"
        }
      ],
      "defaultValue": "inherit"
    },
    {
      "key": "paddingX",
      "displayName": "Horizontal Padding",
      "type": "select",
      "options": [
        {
          "value": "px_8",
          "displayName": "8px"
        },
        {
          "value": "none",
          "displayName": "None (0px)"
        },
        {
          "value": "px_16",
          "displayName": "16px"
        },
        {
          "value": "compact",
          "displayName": "Compact (16px)"
        },
        {
          "value": "px_28",
          "displayName": "28px"
        },
        {
          "value": "default",
          "displayName": "Default (8px / 32px lg)"
        },
        {
          "value": "loose",
          "displayName": "Loose (64px)"
        }
      ],
      "defaultValue": "default"
    },
    {
      "key": "paddingXLg",
      "displayName": "Horizontal Padding - Desktop (lg 1024px)",
      "type": "select",
      "options": [
        {
          "value": "default",
          "displayName": "Default (32px)"
        },
        {
          "value": "inherit",
          "displayName": "Inherit"
        },
        {
          "value": "none",
          "displayName": "None (0px)"
        },
        {
          "value": "compact",
          "displayName": "Compact (16px)"
        },
        {
          "value": "loose",
          "displayName": "Loose (64px)"
        }
      ],
      "defaultValue": "inherit"
    },
    {
      "key": "paddingXMd",
      "displayName": "Horizontal Padding - Tablet (md 768px)",
      "type": "select",
      "options": [
        {
          "value": "inherit",
          "displayName": "Inherit"
        },
        {
          "value": "none",
          "displayName": "None (0px)"
        },
        {
          "value": "compact",
          "displayName": "Compact (16px)"
        },
        {
          "value": "default",
          "displayName": "Default (32px)"
        },
        {
          "value": "loose",
          "displayName": "Loose (64px)"
        }
      ],
      "defaultValue": "inherit"
    },
    {
      "key": "outerPaddingTop",
      "displayName": "Outer Padding Top",
      "type": "select",
      "options": [
        {
          "value": "none",
          "displayName": "None (0px)"
        },
        {
          "value": "compact",
          "displayName": "Compact (16px)"
        },
        {
          "value": "default",
          "displayName": "Default (32px)"
        },
        {
          "value": "px_48",
          "displayName": "48px"
        },
        {
          "value": "loose",
          "displayName": "Loose (64px)"
        },
        {
          "value": "px_80",
          "displayName": "80px"
        },
        {
          "value": "extra_loose",
          "displayName": "Extra Loose (96px)"
        },
        {
          "value": "xxl",
          "displayName": "XXL (128px)"
        }
      ],
      "defaultValue": "none"
    },
    {
      "key": "outerPaddingTopMd",
      "displayName": "Outer Padding Top - Tablet (md 768px)",
      "type": "select",
      "options": [
        {
          "value": "inherit",
          "displayName": "Inherit"
        },
        {
          "value": "none",
          "displayName": "None (0px)"
        },
        {
          "value": "compact",
          "displayName": "Compact (16px)"
        },
        {
          "value": "default",
          "displayName": "Default (32px)"
        },
        {
          "value": "px_48",
          "displayName": "48px"
        },
        {
          "value": "loose",
          "displayName": "Loose (64px)"
        },
        {
          "value": "px_80",
          "displayName": "80px"
        },
        {
          "value": "extra_loose",
          "displayName": "Extra Loose (96px)"
        },
        {
          "value": "xxl",
          "displayName": "XXL (128px)"
        }
      ],
      "defaultValue": "inherit"
    },
    {
      "key": "outerPaddingTopLg",
      "displayName": "Outer Padding Top - Desktop (lg 1024px)",
      "type": "select",
      "options": [
        {
          "value": "inherit",
          "displayName": "Inherit"
        },
        {
          "value": "none",
          "displayName": "None (0px)"
        },
        {
          "value": "compact",
          "displayName": "Compact (16px)"
        },
        {
          "value": "default",
          "displayName": "Default (32px)"
        },
        {
          "value": "px_48",
          "displayName": "48px"
        },
        {
          "value": "loose",
          "displayName": "Loose (64px)"
        },
        {
          "value": "px_80",
          "displayName": "80px"
        },
        {
          "value": "extra_loose",
          "displayName": "Extra Loose (96px)"
        },
        {
          "value": "xxl",
          "displayName": "XXL (128px)"
        }
      ],
      "defaultValue": "inherit"
    },
    {
      "key": "outerPaddingBottom",
      "displayName": "Outer Padding Bottom",
      "type": "select",
      "options": [
        {
          "value": "none",
          "displayName": "None (0px)"
        },
        {
          "value": "compact",
          "displayName": "Compact (16px)"
        },
        {
          "value": "default",
          "displayName": "Default (32px)"
        },
        {
          "value": "px_48",
          "displayName": "48px"
        },
        {
          "value": "loose",
          "displayName": "Loose (64px)"
        },
        {
          "value": "px_80",
          "displayName": "80px"
        },
        {
          "value": "extra_loose",
          "displayName": "Extra Loose (96px)"
        },
        {
          "value": "xxl",
          "displayName": "XXL (128px)"
        }
      ],
      "defaultValue": "none"
    },
    {
      "key": "outerPaddingBottomMd",
      "displayName": "Outer Padding Bottom - Tablet (md 768px)",
      "type": "select",
      "options": [
        {
          "value": "inherit",
          "displayName": "Inherit"
        },
        {
          "value": "none",
          "displayName": "None (0px)"
        },
        {
          "value": "compact",
          "displayName": "Compact (16px)"
        },
        {
          "value": "default",
          "displayName": "Default (32px)"
        },
        {
          "value": "px_48",
          "displayName": "48px"
        },
        {
          "value": "loose",
          "displayName": "Loose (64px)"
        },
        {
          "value": "px_80",
          "displayName": "80px"
        },
        {
          "value": "extra_loose",
          "displayName": "Extra Loose (96px)"
        },
        {
          "value": "xxl",
          "displayName": "XXL (128px)"
        }
      ],
      "defaultValue": "inherit"
    },
    {
      "key": "outerPaddingBottomLg",
      "displayName": "Outer Padding Bottom - Desktop (lg 1024px)",
      "type": "select",
      "options": [
        {
          "value": "inherit",
          "displayName": "Inherit"
        },
        {
          "value": "none",
          "displayName": "None (0px)"
        },
        {
          "value": "compact",
          "displayName": "Compact (16px)"
        },
        {
          "value": "default",
          "displayName": "Default (32px)"
        },
        {
          "value": "px_48",
          "displayName": "48px"
        },
        {
          "value": "loose",
          "displayName": "Loose (64px)"
        },
        {
          "value": "px_80",
          "displayName": "80px"
        },
        {
          "value": "extra_loose",
          "displayName": "Extra Loose (96px)"
        },
        {
          "value": "xxl",
          "displayName": "XXL (128px)"
        }
      ],
      "defaultValue": "inherit"
    },
    {
      "key": "roundedCorners",
      "displayName": "Rounded Corners",
      "type": "select",
      "options": [
        {
          "value": "top",
          "displayName": "Top Only"
        },
        {
          "value": "all",
          "displayName": "All Corners"
        },
        {
          "value": "bottom",
          "displayName": "Bottom Only"
        },
        {
          "value": "none",
          "displayName": "None"
        }
      ],
      "defaultValue": "top"
    },
    {
      "key": "borderRadius",
      "displayName": "Border Radius",
      "type": "select",
      "options": [
        {
          "value": "default",
          "displayName": "Large (24px)"
        },
        {
          "value": "none",
          "displayName": "None (0px)"
        },
        {
          "value": "xs",
          "displayName": "Small (12px)"
        },
        {
          "value": "sm",
          "displayName": "Medium (16px)"
        },
        {
          "value": "lg",
          "displayName": "X-Large (40px)"
        }
      ],
      "defaultValue": "default"
    },
    {
      "key": "borderRadiusLg",
      "displayName": "Border Radius - Desktop (lg 1024px)",
      "type": "select",
      "options": [
        {
          "value": "lg",
          "displayName": "X-Large (40px)"
        },
        {
          "value": "inherit",
          "displayName": "Inherit"
        },
        {
          "value": "none",
          "displayName": "None (0px)"
        },
        {
          "value": "xs",
          "displayName": "Small (12px)"
        },
        {
          "value": "sm",
          "displayName": "Medium (16px)"
        },
        {
          "value": "default",
          "displayName": "Large (24px)"
        }
      ],
      "defaultValue": "lg"
    },
    {
      "key": "contentWidth",
      "displayName": "Content Width",
      "type": "select",
      "options": [
        {
          "value": "full",
          "displayName": "Full Width"
        },
        {
          "value": "cols_5",
          "displayName": "5/12 (41.67%)"
        },
        {
          "value": "cols_6",
          "displayName": "6/12 (50%)"
        },
        {
          "value": "cols_7",
          "displayName": "7/12 (58.33%)"
        },
        {
          "value": "cols_8",
          "displayName": "8/12 (66.67%)"
        },
        {
          "value": "cols_9",
          "displayName": "9/12 (75%)"
        },
        {
          "value": "cols_10",
          "displayName": "10/12 (83.33%)"
        },
        {
          "value": "cols_11",
          "displayName": "11/12 (91.67%)"
        }
      ],
      "defaultValue": "full"
    },
    {
      "key": "marginTop",
      "displayName": "Margin Top",
      "type": "select",
      "options": [
        {
          "value": "negative_md",
          "displayName": "Negative Medium (-24px)"
        },
        {
          "value": "negative_2xl",
          "displayName": "Negative 2X Large (-128px)"
        },
        {
          "value": "negative_xl",
          "displayName": "Negative X-Large (-80px)"
        },
        {
          "value": "negative_lg",
          "displayName": "Negative Large (-40px)"
        },
        {
          "value": "negative_sm",
          "displayName": "Negative Small (-16px)"
        },
        {
          "value": "none",
          "displayName": "None (0px)"
        },
        {
          "value": "sm",
          "displayName": "Small (16px)"
        },
        {
          "value": "md",
          "displayName": "Medium (24px)"
        },
        {
          "value": "lg",
          "displayName": "Large (32px)"
        },
        {
          "value": "xl",
          "displayName": "Extra Large (48px)"
        },
        {
          "value": "m_2xl",
          "displayName": "2X Large (64px)"
        },
        {
          "value": "m_2_5xl",
          "displayName": "2.5X Large (80px)"
        },
        {
          "value": "m_3xl",
          "displayName": "3X Large (96px)"
        },
        {
          "value": "m_4xl",
          "displayName": "4X Large (128px)"
        }
      ],
      "defaultValue": "none"
    },
    {
      "key": "marginTopMd",
      "displayName": "Margin Top - Tablet (md 768px)",
      "type": "select",
      "options": [
        {
          "value": "negative_md",
          "displayName": "Negative Medium (-24px)"
        },
        {
          "value": "inherit",
          "displayName": "Inherit"
        },
        {
          "value": "negative_2xl",
          "displayName": "Negative 2X Large (-128px)"
        },
        {
          "value": "negative_xl",
          "displayName": "Negative X-Large (-80px)"
        },
        {
          "value": "negative_lg",
          "displayName": "Negative Large (-40px)"
        },
        {
          "value": "negative_sm",
          "displayName": "Negative Small (-16px)"
        },
        {
          "value": "none",
          "displayName": "None (0px)"
        },
        {
          "value": "sm",
          "displayName": "Small (16px)"
        },
        {
          "value": "md",
          "displayName": "Medium (24px)"
        },
        {
          "value": "lg",
          "displayName": "Large (32px)"
        },
        {
          "value": "xl",
          "displayName": "Extra Large (48px)"
        },
        {
          "value": "m_2xl",
          "displayName": "2X Large (64px)"
        },
        {
          "value": "m_2_5xl",
          "displayName": "2.5X Large (80px)"
        },
        {
          "value": "m_3xl",
          "displayName": "3X Large (96px)"
        },
        {
          "value": "m_4xl",
          "displayName": "4X Large (128px)"
        }
      ],
      "defaultValue": "inherit"
    },
    {
      "key": "marginTopLg",
      "displayName": "Margin Top - Desktop (lg 1024px)",
      "type": "select",
      "options": [
        {
          "value": "negative_lg",
          "displayName": "Negative Large (-40px)"
        },
        {
          "value": "inherit",
          "displayName": "Inherit"
        },
        {
          "value": "negative_2xl",
          "displayName": "Negative 2X Large (-128px)"
        },
        {
          "value": "negative_xl",
          "displayName": "Negative X-Large (-80px)"
        },
        {
          "value": "negative_md",
          "displayName": "Negative Medium (-24px)"
        },
        {
          "value": "negative_sm",
          "displayName": "Negative Small (-16px)"
        },
        {
          "value": "none",
          "displayName": "None (0px)"
        },
        {
          "value": "sm",
          "displayName": "Small (16px)"
        },
        {
          "value": "md",
          "displayName": "Medium (24px)"
        },
        {
          "value": "lg",
          "displayName": "Large (32px)"
        },
        {
          "value": "xl",
          "displayName": "Extra Large (48px)"
        },
        {
          "value": "m_2xl",
          "displayName": "2X Large (64px)"
        },
        {
          "value": "m_2_5xl",
          "displayName": "2.5X Large (80px)"
        },
        {
          "value": "m_3xl",
          "displayName": "3X Large (96px)"
        },
        {
          "value": "m_4xl",
          "displayName": "4X Large (128px)"
        }
      ],
      "defaultValue": "inherit"
    },
    {
      "key": "marginBottom",
      "displayName": "Margin Bottom",
      "type": "select",
      "options": [
        {
          "value": "none",
          "displayName": "None (0px)"
        },
        {
          "value": "negative_2xl",
          "displayName": "Negative 2X Large (-128px)"
        },
        {
          "value": "negative_xl",
          "displayName": "Negative X-Large (-80px)"
        },
        {
          "value": "negative_lg",
          "displayName": "Negative Large (-40px)"
        },
        {
          "value": "negative_md",
          "displayName": "Negative Medium (-24px)"
        },
        {
          "value": "negative_sm",
          "displayName": "Negative Small (-16px)"
        },
        {
          "value": "sm",
          "displayName": "Small (16px)"
        },
        {
          "value": "md",
          "displayName": "Medium (24px)"
        },
        {
          "value": "lg",
          "displayName": "Large (32px)"
        },
        {
          "value": "xl",
          "displayName": "Extra Large (48px)"
        },
        {
          "value": "m_2xl",
          "displayName": "2X Large (64px)"
        },
        {
          "value": "m_2_5xl",
          "displayName": "2.5X Large (80px)"
        },
        {
          "value": "m_3xl",
          "displayName": "3X Large (96px)"
        },
        {
          "value": "m_4xl",
          "displayName": "4X Large (128px)"
        }
      ],
      "defaultValue": "none"
    },
    {
      "key": "marginBottomMd",
      "displayName": "Margin Bottom - Tablet (md 768px)",
      "type": "select",
      "options": [
        {
          "value": "inherit",
          "displayName": "Inherit"
        },
        {
          "value": "negative_2xl",
          "displayName": "Negative 2X Large (-128px)"
        },
        {
          "value": "negative_xl",
          "displayName": "Negative X-Large (-80px)"
        },
        {
          "value": "negative_lg",
          "displayName": "Negative Large (-40px)"
        },
        {
          "value": "negative_md",
          "displayName": "Negative Medium (-24px)"
        },
        {
          "value": "negative_sm",
          "displayName": "Negative Small (-16px)"
        },
        {
          "value": "none",
          "displayName": "None (0px)"
        },
        {
          "value": "sm",
          "displayName": "Small (16px)"
        },
        {
          "value": "md",
          "displayName": "Medium (24px)"
        },
        {
          "value": "lg",
          "displayName": "Large (32px)"
        },
        {
          "value": "xl",
          "displayName": "Extra Large (48px)"
        },
        {
          "value": "m_2xl",
          "displayName": "2X Large (64px)"
        },
        {
          "value": "m_2_5xl",
          "displayName": "2.5X Large (80px)"
        },
        {
          "value": "m_3xl",
          "displayName": "3X Large (96px)"
        },
        {
          "value": "m_4xl",
          "displayName": "4X Large (128px)"
        }
      ],
      "defaultValue": "inherit"
    },
    {
      "key": "marginBottomLg",
      "displayName": "Margin Bottom - Desktop (lg 1024px)",
      "type": "select",
      "options": [
        {
          "value": "inherit",
          "displayName": "Inherit"
        },
        {
          "value": "negative_2xl",
          "displayName": "Negative 2X Large (-128px)"
        },
        {
          "value": "negative_xl",
          "displayName": "Negative X-Large (-80px)"
        },
        {
          "value": "negative_lg",
          "displayName": "Negative Large (-40px)"
        },
        {
          "value": "negative_md",
          "displayName": "Negative Medium (-24px)"
        },
        {
          "value": "negative_sm",
          "displayName": "Negative Small (-16px)"
        },
        {
          "value": "none",
          "displayName": "None (0px)"
        },
        {
          "value": "sm",
          "displayName": "Small (16px)"
        },
        {
          "value": "md",
          "displayName": "Medium (24px)"
        },
        {
          "value": "lg",
          "displayName": "Large (32px)"
        },
        {
          "value": "xl",
          "displayName": "Extra Large (48px)"
        },
        {
          "value": "m_2xl",
          "displayName": "2X Large (64px)"
        },
        {
          "value": "m_2_5xl",
          "displayName": "2.5X Large (80px)"
        },
        {
          "value": "m_3xl",
          "displayName": "3X Large (96px)"
        },
        {
          "value": "m_4xl",
          "displayName": "4X Large (128px)"
        }
      ],
      "defaultValue": "inherit"
    },
    {
      "key": "contentAlign",
      "displayName": "Content Alignment (content, vertical)",
      "type": "select",
      "options": [
        {
          "value": "start",
          "displayName": "Top"
        },
        {
          "value": "center",
          "displayName": "Center"
        },
        {
          "value": "end",
          "displayName": "Bottom"
        },
        {
          "value": "between",
          "displayName": "Space Between"
        }
      ],
      "defaultValue": "start"
    },
    {
      "key": "rowGap",
      "displayName": "Row Gap (between rows)",
      "type": "select",
      "options": [
        {
          "value": "none",
          "displayName": "None (0)"
        },
        {
          "value": "xs",
          "displayName": "Extra Small (8px)"
        },
        {
          "value": "sm",
          "displayName": "Small (16px)"
        },
        {
          "value": "md",
          "displayName": "Medium (24px)"
        },
        {
          "value": "lg",
          "displayName": "Large (32px)"
        },
        {
          "value": "xl",
          "displayName": "Extra Large (48px)"
        },
        {
          "value": "xxl",
          "displayName": "2X Large (96px)"
        },
        {
          "value": "xxxl",
          "displayName": "3X Large (144px)"
        }
      ],
      "defaultValue": "none"
    },
    {
      "key": "rowGapMd",
      "displayName": "Row Gap - Tablet (md 768px)",
      "type": "select",
      "options": [
        {
          "value": "inherit",
          "displayName": "Inherit"
        },
        {
          "value": "none",
          "displayName": "None (0)"
        },
        {
          "value": "xs",
          "displayName": "Extra Small (8px)"
        },
        {
          "value": "sm",
          "displayName": "Small (16px)"
        },
        {
          "value": "md",
          "displayName": "Medium (24px)"
        },
        {
          "value": "lg",
          "displayName": "Large (32px)"
        },
        {
          "value": "xl",
          "displayName": "Extra Large (48px)"
        },
        {
          "value": "xxl",
          "displayName": "2X Large (96px)"
        },
        {
          "value": "xxxl",
          "displayName": "3X Large (144px)"
        }
      ],
      "defaultValue": "inherit"
    },
    {
      "key": "rowGapLg",
      "displayName": "Row Gap - Desktop (lg 1024px)",
      "type": "select",
      "options": [
        {
          "value": "inherit",
          "displayName": "Inherit"
        },
        {
          "value": "none",
          "displayName": "None (0)"
        },
        {
          "value": "xs",
          "displayName": "Extra Small (8px)"
        },
        {
          "value": "sm",
          "displayName": "Small (16px)"
        },
        {
          "value": "md",
          "displayName": "Medium (24px)"
        },
        {
          "value": "lg",
          "displayName": "Large (32px)"
        },
        {
          "value": "xl",
          "displayName": "Extra Large (48px)"
        },
        {
          "value": "xxl",
          "displayName": "2X Large (96px)"
        },
        {
          "value": "xxxl",
          "displayName": "3X Large (144px)"
        }
      ],
      "defaultValue": "inherit"
    },
    {
      "key": "minHeight",
      "displayName": "Minimum Height",
      "type": "select",
      "options": [
        {
          "value": "none",
          "displayName": "None"
        },
        {
          "value": "px_500",
          "displayName": "500px"
        },
        {
          "value": "px_600",
          "displayName": "600px"
        },
        {
          "value": "px_800",
          "displayName": "800px"
        }
      ],
      "defaultValue": "none"
    },
    {
      "key": "height",
      "displayName": "Height",
      "type": "select",
      "options": [
        {
          "value": "auto",
          "displayName": "Auto"
        },
        {
          "value": "vh_50",
          "displayName": "50vh"
        },
        {
          "value": "vh_60",
          "displayName": "60vh"
        },
        {
          "value": "vh_70",
          "displayName": "70vh"
        },
        {
          "value": "vh_80",
          "displayName": "80vh"
        },
        {
          "value": "vh_90",
          "displayName": "90vh"
        },
        {
          "value": "vh_100",
          "displayName": "100vh"
        }
      ],
      "defaultValue": "auto"
    },
    {
      "key": "backgroundMedia",
      "displayName": "Background Media",
      "type": "select",
      "options": [
        {
          "value": "none",
          "displayName": "None"
        },
        {
          "value": "image",
          "displayName": "Image"
        },
        {
          "value": "video",
          "displayName": "Video"
        },
        {
          "value": "lottie",
          "displayName": "Lottie Animation"
        },
        {
          "value": "rive",
          "displayName": "Rive Animation"
        }
      ],
      "defaultValue": "none"
    },
    {
      "key": "backgroundMediaFit",
      "displayName": "Background Media Fit",
      "type": "select",
      "options": [
        {
          "value": "cover",
          "displayName": "Cover"
        },
        {
          "value": "contain",
          "displayName": "Contain"
        }
      ],
      "defaultValue": "cover"
    },
    {
      "key": "backgroundMediaPosition",
      "displayName": "Background Media Position",
      "type": "select",
      "options": [
        {
          "value": "center",
          "displayName": "Center"
        },
        {
          "value": "top",
          "displayName": "Top"
        },
        {
          "value": "bottom",
          "displayName": "Bottom"
        },
        {
          "value": "left",
          "displayName": "Left"
        },
        {
          "value": "right",
          "displayName": "Right"
        },
        {
          "value": "top_left",
          "displayName": "Top Left"
        },
        {
          "value": "top_right",
          "displayName": "Top Right"
        },
        {
          "value": "bottom_left",
          "displayName": "Bottom Left"
        },
        {
          "value": "bottom_right",
          "displayName": "Bottom Right"
        }
      ],
      "defaultValue": "center"
    },
    {
      "key": "backgroundMediaOverlay",
      "displayName": "Background Media Overlay",
      "type": "select",
      "options": [
        {
          "value": "none",
          "displayName": "None"
        },
        {
          "value": "light",
          "displayName": "Light (20%)"
        },
        {
          "value": "medium",
          "displayName": "Medium (40%)"
        },
        {
          "value": "dark",
          "displayName": "Dark (60%)"
        },
        {
          "value": "heavy",
          "displayName": "Heavy (80%)"
        }
      ],
      "defaultValue": "none"
    },
    {
      "key": "hideMobile",
      "displayName": "Hide on Mobile",
      "type": "checkbox",
      "defaultValue": false
    },
    {
      "key": "hideTablet",
      "displayName": "Hide on Tablet",
      "type": "checkbox",
      "defaultValue": false
    },
    {
      "key": "hideDesktop",
      "displayName": "Hide on Desktop",
      "type": "checkbox",
      "defaultValue": false
    },
    {
      "key": "reactionOnFormSubmit",
      "displayName": "Reaction on Form submit",
      "type": "select",
      "options": [
        {
          "value": "none",
          "displayName": "None (default)"
        },
        {
          "value": "hide",
          "displayName": "Hide on submit (remove from DOM)"
        },
        {
          "value": "show",
          "displayName": "Show on submit (added to DOM on success)"
        }
      ],
      "defaultValue": "none"
    }
  ]
}]

export default displayTemplates
