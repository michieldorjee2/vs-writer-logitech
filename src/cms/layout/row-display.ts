/**
 * GENERATED from optimizely.com PROD's live `RowDisplayTemplate` by scripts/sync-prod-layout-templates.ts.
 * Do not hand-edit — re-run the script. Rendered by src/cms/layout-prod, whose class maps come
 * from the same prod source. 35 settings.
 */
import type { RepoDisplayTemplate } from '../display-template-transform'

const displayTemplates: RepoDisplayTemplate[] = [{
  "key": "RowDisplayTemplate",
  "displayName": "Row Display Template",
  "nodeType": "row",
  "isDefault": true,
  "settings": [
    {
      "key": "displayMode",
      "displayName": "Display Mode",
      "type": "select",
      "options": [
        {
          "value": "flex",
          "displayName": "Flex"
        },
        {
          "value": "grid",
          "displayName": "Grid"
        }
      ],
      "defaultValue": "flex"
    },
    {
      "key": "flexBreakpoint",
      "displayName": "Flex Breakpoint",
      "type": "select",
      "options": [
        {
          "value": "lg",
          "displayName": "Large (1024px)"
        },
        {
          "value": "none",
          "displayName": "Always Row"
        },
        {
          "value": "sm",
          "displayName": "Small (640px)"
        },
        {
          "value": "md",
          "displayName": "Medium (768px)"
        },
        {
          "value": "xl",
          "displayName": "Extra Large (1280px)"
        }
      ],
      "defaultValue": "lg"
    },
    {
      "key": "gridColumns",
      "displayName": "Grid Columns (mobile)",
      "type": "select",
      "options": [
        {
          "value": "cols_1",
          "displayName": "1 Column"
        },
        {
          "value": "auto",
          "displayName": "Auto"
        },
        {
          "value": "none",
          "displayName": "None"
        },
        {
          "value": "cols_2",
          "displayName": "2 Columns"
        },
        {
          "value": "cols_3",
          "displayName": "3 Columns"
        },
        {
          "value": "cols_4",
          "displayName": "4 Columns"
        },
        {
          "value": "cols_5",
          "displayName": "5 Columns"
        },
        {
          "value": "cols_6",
          "displayName": "6 Columns"
        },
        {
          "value": "cols_7",
          "displayName": "7 Columns"
        },
        {
          "value": "cols_8",
          "displayName": "8 Columns"
        },
        {
          "value": "cols_9",
          "displayName": "9 Columns"
        },
        {
          "value": "cols_10",
          "displayName": "10 Columns"
        },
        {
          "value": "cols_11",
          "displayName": "11 Columns"
        },
        {
          "value": "cols_12",
          "displayName": "12 Columns"
        }
      ],
      "defaultValue": "none"
    },
    {
      "key": "gridColumnsMd",
      "displayName": "Grid Columns (tablet)",
      "type": "select",
      "options": [
        {
          "value": "inherit",
          "displayName": "Inherit from base"
        },
        {
          "value": "auto",
          "displayName": "Auto"
        },
        {
          "value": "none",
          "displayName": "None"
        },
        {
          "value": "cols_1",
          "displayName": "1 Column"
        },
        {
          "value": "cols_2",
          "displayName": "2 Columns"
        },
        {
          "value": "cols_3",
          "displayName": "3 Columns"
        },
        {
          "value": "cols_4",
          "displayName": "4 Columns"
        },
        {
          "value": "cols_5",
          "displayName": "5 Columns"
        },
        {
          "value": "cols_6",
          "displayName": "6 Columns"
        },
        {
          "value": "cols_7",
          "displayName": "7 Columns"
        },
        {
          "value": "cols_8",
          "displayName": "8 Columns"
        },
        {
          "value": "cols_9",
          "displayName": "9 Columns"
        },
        {
          "value": "cols_10",
          "displayName": "10 Columns"
        },
        {
          "value": "cols_11",
          "displayName": "11 Columns"
        },
        {
          "value": "cols_12",
          "displayName": "12 Columns"
        }
      ],
      "defaultValue": "inherit"
    },
    {
      "key": "gridColumnsLg",
      "displayName": "Grid Columns (desktop)",
      "type": "select",
      "options": [
        {
          "value": "inherit",
          "displayName": "Inherit from md"
        },
        {
          "value": "auto",
          "displayName": "Auto"
        },
        {
          "value": "none",
          "displayName": "None"
        },
        {
          "value": "cols_1",
          "displayName": "1 Column"
        },
        {
          "value": "cols_2",
          "displayName": "2 Columns"
        },
        {
          "value": "cols_3",
          "displayName": "3 Columns"
        },
        {
          "value": "cols_4",
          "displayName": "4 Columns"
        },
        {
          "value": "cols_5",
          "displayName": "5 Columns"
        },
        {
          "value": "cols_6",
          "displayName": "6 Columns"
        },
        {
          "value": "cols_7",
          "displayName": "7 Columns"
        },
        {
          "value": "cols_8",
          "displayName": "8 Columns"
        },
        {
          "value": "cols_9",
          "displayName": "9 Columns"
        },
        {
          "value": "cols_10",
          "displayName": "10 Columns"
        },
        {
          "value": "cols_11",
          "displayName": "11 Columns"
        },
        {
          "value": "cols_12",
          "displayName": "12 Columns"
        }
      ],
      "defaultValue": "inherit"
    },
    {
      "key": "gridColumnsXl",
      "displayName": "Grid Columns (large desktop)",
      "type": "select",
      "options": [
        {
          "value": "inherit",
          "displayName": "Inherit from lg"
        },
        {
          "value": "auto",
          "displayName": "Auto"
        },
        {
          "value": "none",
          "displayName": "None"
        },
        {
          "value": "cols_1",
          "displayName": "1 Column"
        },
        {
          "value": "cols_2",
          "displayName": "2 Columns"
        },
        {
          "value": "cols_3",
          "displayName": "3 Columns"
        },
        {
          "value": "cols_4",
          "displayName": "4 Columns"
        },
        {
          "value": "cols_5",
          "displayName": "5 Columns"
        },
        {
          "value": "cols_6",
          "displayName": "6 Columns"
        },
        {
          "value": "cols_7",
          "displayName": "7 Columns"
        },
        {
          "value": "cols_8",
          "displayName": "8 Columns"
        },
        {
          "value": "cols_9",
          "displayName": "9 Columns"
        },
        {
          "value": "cols_10",
          "displayName": "10 Columns"
        },
        {
          "value": "cols_11",
          "displayName": "11 Columns"
        },
        {
          "value": "cols_12",
          "displayName": "12 Columns"
        }
      ],
      "defaultValue": "inherit"
    },
    {
      "key": "gridRows",
      "displayName": "Grid Rows",
      "type": "select",
      "options": [
        {
          "value": "auto",
          "displayName": "Auto"
        },
        {
          "value": "none",
          "displayName": "None"
        },
        {
          "value": "rows_1",
          "displayName": "1 Row"
        },
        {
          "value": "rows_2",
          "displayName": "2 Rows"
        },
        {
          "value": "rows_3",
          "displayName": "3 Rows"
        },
        {
          "value": "rows_4",
          "displayName": "4 Rows"
        },
        {
          "value": "rows_5",
          "displayName": "5 Rows"
        },
        {
          "value": "rows_6",
          "displayName": "6 Rows"
        }
      ],
      "defaultValue": "auto"
    },
    {
      "key": "gap",
      "displayName": "Gap",
      "type": "select",
      "options": [
        {
          "value": "sm",
          "displayName": "Small (16px)"
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
      "defaultValue": "sm"
    },
    {
      "key": "columnGap",
      "displayName": "Column Gap (mobile)",
      "type": "select",
      "options": [
        {
          "value": "sm",
          "displayName": "Small (16px)"
        },
        {
          "value": "inherit",
          "displayName": "Use Gap Setting"
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
      "key": "columnGapMd",
      "displayName": "Column Gap (tablet)",
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
      "key": "columnGapLg",
      "displayName": "Column Gap (desktop)",
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
      "key": "rowGap",
      "displayName": "Row Gap (mobile)",
      "type": "select",
      "options": [
        {
          "value": "inherit",
          "displayName": "Use Gap Setting"
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
      "key": "rowGapMd",
      "displayName": "Row Gap (tablet)",
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
      "displayName": "Row Gap (desktop)",
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
      "key": "justifyItems",
      "displayName": "Justify Items (items, horizontal)",
      "type": "select",
      "options": [
        {
          "value": "default",
          "displayName": "Default (Stretch)"
        },
        {
          "value": "start",
          "displayName": "Start"
        },
        {
          "value": "center",
          "displayName": "Center"
        },
        {
          "value": "end",
          "displayName": "End"
        }
      ],
      "defaultValue": "default"
    },
    {
      "key": "alignItems",
      "displayName": "Align Items (items, vertical)",
      "type": "select",
      "options": [
        {
          "value": "default",
          "displayName": "Default (Stretch)"
        },
        {
          "value": "start",
          "displayName": "Start"
        },
        {
          "value": "center",
          "displayName": "Center"
        },
        {
          "value": "end",
          "displayName": "End"
        },
        {
          "value": "baseline",
          "displayName": "Baseline"
        }
      ],
      "defaultValue": "default"
    },
    {
      "key": "justifyContent",
      "displayName": "Justify Content (columns, horizontal)",
      "type": "select",
      "options": [
        {
          "value": "default",
          "displayName": "Default (Start)"
        },
        {
          "value": "center",
          "displayName": "Center"
        },
        {
          "value": "end",
          "displayName": "End"
        },
        {
          "value": "between",
          "displayName": "Space Between"
        },
        {
          "value": "around",
          "displayName": "Space Around"
        },
        {
          "value": "evenly",
          "displayName": "Space Evenly"
        }
      ],
      "defaultValue": "default"
    },
    {
      "key": "alignContent",
      "displayName": "Align Content (rows, vertical)",
      "type": "select",
      "options": [
        {
          "value": "default",
          "displayName": "Default (Start)"
        },
        {
          "value": "center",
          "displayName": "Center"
        },
        {
          "value": "end",
          "displayName": "End"
        },
        {
          "value": "between",
          "displayName": "Space Between"
        },
        {
          "value": "around",
          "displayName": "Space Around"
        },
        {
          "value": "evenly",
          "displayName": "Space Evenly"
        }
      ],
      "defaultValue": "default"
    },
    {
      "key": "gridAutoFlow",
      "displayName": "Grid Auto Flow",
      "type": "select",
      "options": [
        {
          "value": "row",
          "displayName": "Row (Default)"
        },
        {
          "value": "col",
          "displayName": "Column"
        },
        {
          "value": "dense",
          "displayName": "Dense"
        },
        {
          "value": "row_dense",
          "displayName": "Row Dense"
        },
        {
          "value": "col_dense",
          "displayName": "Column Dense"
        }
      ],
      "defaultValue": "row"
    },
    {
      "key": "centerLastRow",
      "displayName": "Center Last Row",
      "type": "checkbox",
      "defaultValue": false
    },
    {
      "key": "separators",
      "displayName": "Column Separators",
      "type": "select",
      "options": [
        {
          "value": "none",
          "displayName": "None"
        },
        {
          "value": "vertical",
          "displayName": "Vertical Lines"
        }
      ],
      "defaultValue": "none"
    },
    {
      "key": "marginTop",
      "displayName": "Margin Top (mobile)",
      "type": "select",
      "options": [
        {
          "value": "none",
          "displayName": "None (0px)"
        },
        {
          "value": "mt_16",
          "displayName": "16px"
        },
        {
          "value": "mt_32",
          "displayName": "32px"
        },
        {
          "value": "mt_48",
          "displayName": "48px"
        },
        {
          "value": "mt_64",
          "displayName": "64px"
        },
        {
          "value": "mt_80",
          "displayName": "80px"
        },
        {
          "value": "mt_96",
          "displayName": "96px"
        },
        {
          "value": "mt_112",
          "displayName": "112px"
        },
        {
          "value": "mt_128",
          "displayName": "128px"
        }
      ],
      "defaultValue": "none"
    },
    {
      "key": "marginTopMd",
      "displayName": "Margin Top (tablet)",
      "type": "select",
      "options": [
        {
          "value": "none",
          "displayName": "None (0px)"
        },
        {
          "value": "mt_16",
          "displayName": "16px"
        },
        {
          "value": "mt_32",
          "displayName": "32px"
        },
        {
          "value": "mt_48",
          "displayName": "48px"
        },
        {
          "value": "mt_64",
          "displayName": "64px"
        },
        {
          "value": "mt_80",
          "displayName": "80px"
        },
        {
          "value": "mt_96",
          "displayName": "96px"
        },
        {
          "value": "mt_112",
          "displayName": "112px"
        },
        {
          "value": "mt_128",
          "displayName": "128px"
        }
      ],
      "defaultValue": "none"
    },
    {
      "key": "marginTopLg",
      "displayName": "Margin Top (desktop)",
      "type": "select",
      "options": [
        {
          "value": "none",
          "displayName": "None (0px)"
        },
        {
          "value": "mt_16",
          "displayName": "16px"
        },
        {
          "value": "mt_32",
          "displayName": "32px"
        },
        {
          "value": "mt_48",
          "displayName": "48px"
        },
        {
          "value": "mt_64",
          "displayName": "64px"
        },
        {
          "value": "mt_80",
          "displayName": "80px"
        },
        {
          "value": "mt_96",
          "displayName": "96px"
        },
        {
          "value": "mt_112",
          "displayName": "112px"
        },
        {
          "value": "mt_128",
          "displayName": "128px"
        }
      ],
      "defaultValue": "none"
    },
    {
      "key": "marginBottom",
      "displayName": "Margin Bottom (mobile)",
      "type": "select",
      "options": [
        {
          "value": "none",
          "displayName": "None (0px)"
        },
        {
          "value": "mb_16",
          "displayName": "16px"
        },
        {
          "value": "mb_32",
          "displayName": "32px"
        },
        {
          "value": "mb_48",
          "displayName": "48px"
        },
        {
          "value": "mb_64",
          "displayName": "64px"
        },
        {
          "value": "mb_80",
          "displayName": "80px"
        },
        {
          "value": "mb_96",
          "displayName": "96px"
        },
        {
          "value": "mb_112",
          "displayName": "112px"
        },
        {
          "value": "mb_128",
          "displayName": "128px"
        }
      ],
      "defaultValue": "none"
    },
    {
      "key": "marginBottomMd",
      "displayName": "Margin Bottom (tablet)",
      "type": "select",
      "options": [
        {
          "value": "none",
          "displayName": "None (0px)"
        },
        {
          "value": "mb_16",
          "displayName": "16px"
        },
        {
          "value": "mb_32",
          "displayName": "32px"
        },
        {
          "value": "mb_48",
          "displayName": "48px"
        },
        {
          "value": "mb_64",
          "displayName": "64px"
        },
        {
          "value": "mb_80",
          "displayName": "80px"
        },
        {
          "value": "mb_96",
          "displayName": "96px"
        },
        {
          "value": "mb_112",
          "displayName": "112px"
        },
        {
          "value": "mb_128",
          "displayName": "128px"
        }
      ],
      "defaultValue": "none"
    },
    {
      "key": "marginBottomLg",
      "displayName": "Margin Bottom (desktop)",
      "type": "select",
      "options": [
        {
          "value": "none",
          "displayName": "None (0px)"
        },
        {
          "value": "mb_16",
          "displayName": "16px"
        },
        {
          "value": "mb_32",
          "displayName": "32px"
        },
        {
          "value": "mb_48",
          "displayName": "48px"
        },
        {
          "value": "mb_64",
          "displayName": "64px"
        },
        {
          "value": "mb_80",
          "displayName": "80px"
        },
        {
          "value": "mb_96",
          "displayName": "96px"
        },
        {
          "value": "mb_112",
          "displayName": "112px"
        },
        {
          "value": "mb_128",
          "displayName": "128px"
        }
      ],
      "defaultValue": "none"
    },
    {
      "key": "spacing",
      "displayName": "Spacing",
      "type": "select",
      "options": [
        {
          "value": "default",
          "displayName": "Medium (32px)"
        },
        {
          "value": "none",
          "displayName": "None"
        },
        {
          "value": "extra_small",
          "displayName": "Extra small (8px)"
        },
        {
          "value": "compact",
          "displayName": "Small (16px)"
        },
        {
          "value": "loose",
          "displayName": "Large (64px)"
        }
      ],
      "defaultValue": "default"
    },
    {
      "key": "background",
      "displayName": "Background",
      "type": "select",
      "options": [
        {
          "value": "default",
          "displayName": "Default"
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
          "displayName": "Mid green (grass)"
        },
        {
          "value": "dark_green",
          "displayName": "Dark green (Good2Go)"
        },
        {
          "value": "blue",
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
      "defaultValue": "default"
    },
    {
      "key": "borderRadius",
      "displayName": "Border Radius (mobile)",
      "type": "select",
      "options": [
        {
          "value": "none",
          "displayName": "None"
        },
        {
          "value": "sm",
          "displayName": "Small (8px)"
        },
        {
          "value": "md",
          "displayName": "Medium (12px)"
        },
        {
          "value": "lg",
          "displayName": "Large (16px)"
        },
        {
          "value": "xl",
          "displayName": "Extra Large (24px)"
        },
        {
          "value": "xxl",
          "displayName": "2X Large (35px)"
        }
      ],
      "defaultValue": "none"
    },
    {
      "key": "borderRadiusMd",
      "displayName": "Border Radius (tablet)",
      "type": "select",
      "options": [
        {
          "value": "inherit",
          "displayName": "Inherit"
        },
        {
          "value": "none",
          "displayName": "None"
        },
        {
          "value": "sm",
          "displayName": "Small (8px)"
        },
        {
          "value": "md",
          "displayName": "Medium (12px)"
        },
        {
          "value": "lg",
          "displayName": "Large (16px)"
        },
        {
          "value": "xl",
          "displayName": "Extra Large (24px)"
        },
        {
          "value": "xxl",
          "displayName": "2X Large (35px)"
        }
      ],
      "defaultValue": "inherit"
    },
    {
      "key": "borderRadiusLg",
      "displayName": "Border Radius (desktop)",
      "type": "select",
      "options": [
        {
          "value": "inherit",
          "displayName": "Inherit"
        },
        {
          "value": "none",
          "displayName": "None"
        },
        {
          "value": "sm",
          "displayName": "Small (8px)"
        },
        {
          "value": "md",
          "displayName": "Medium (12px)"
        },
        {
          "value": "lg",
          "displayName": "Large (16px)"
        },
        {
          "value": "xl",
          "displayName": "Extra Large (24px)"
        },
        {
          "value": "xxl",
          "displayName": "2X Large (35px)"
        }
      ],
      "defaultValue": "inherit"
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
    }
  ]
}]

export default displayTemplates
