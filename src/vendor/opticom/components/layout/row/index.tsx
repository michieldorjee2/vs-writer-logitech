import { cva } from 'class-variance-authority'
import { cn, getDisplayValue } from '@/lib/utils'
import { draftClass } from '@/lib/utils/draft-helpers'
import type { RowProps, DisplaySettingValues, RowVariants } from './types'

const gapClassMap = {
  gap: {
    none: 'gap-0',
    xs: 'gap-2',
    sm: 'gap-4',
    md: 'gap-6',
    lg: 'gap-8',
    xl: 'gap-12',
  },
  'gap-x': {
    none: 'gap-x-0',
    xs: 'gap-x-2',
    sm: 'gap-x-4',
    md: 'gap-x-6',
    lg: 'gap-x-8',
    xl: 'gap-x-12',
  },
  'gap-y': {
    none: 'gap-y-0',
    xs: 'gap-y-2',
    sm: 'gap-y-4',
    md: 'gap-y-6',
    lg: 'gap-y-8',
    xl: 'gap-y-12',
  },
} as const

type GapSize = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'

function getGapClasses(displaySettings: RowProps['displaySettings']): string[] {
  const classes: string[] = []

  const gap = getDisplayValue(displaySettings, 'gap') as
    | GapSize
    | 'inherit'
    | undefined
  const columnGap = getDisplayValue(displaySettings, 'columnGap') as
    | GapSize
    | 'inherit'
    | undefined
  const rowGap = getDisplayValue(displaySettings, 'rowGap') as
    | GapSize
    | 'inherit'
    | undefined

  if (gap && gap !== 'inherit') {
    if (columnGap === 'inherit' && rowGap === 'inherit') {
      classes.push(gapClassMap.gap[gap])
    }
  }

  if (columnGap && columnGap !== 'inherit') {
    classes.push(gapClassMap['gap-x'][columnGap])
  }

  if (rowGap && rowGap !== 'inherit') {
    classes.push(gapClassMap['gap-y'][rowGap])
  }

  return classes
}

export const rowVariants = cva('', {
  variants: {
    displayMode: {
      grid: 'grid',
      flex: 'flex flex-1 flex-col flex-nowrap md:flex-row',
    } satisfies Record<
      NonNullable<DisplaySettingValues['displayMode']>,
      string
    >,
    gridColumns: {
      auto: 'grid-cols-auto',
      none: '',
      cols_1: 'grid-cols-1',
      cols_2: 'grid-cols-2',
      cols_3: 'grid-cols-3',
      cols_4: 'grid-cols-4',
      cols_5: 'grid-cols-5',
      cols_6: 'grid-cols-6',
      cols_7: 'grid-cols-7',
      cols_8: 'grid-cols-8',
      cols_9: 'grid-cols-9',
      cols_10: 'grid-cols-10',
      cols_11: 'grid-cols-11',
      cols_12: 'grid-cols-12',
    } satisfies Record<
      NonNullable<DisplaySettingValues['gridColumns']>,
      string
    >,
    gridColumnsMd: {
      inherit: '',
      auto: 'md:grid-cols-auto',
      none: 'md:grid-cols-none',
      cols_1: 'md:grid-cols-1',
      cols_2: 'md:grid-cols-2',
      cols_3: 'md:grid-cols-3',
      cols_4: 'md:grid-cols-4',
      cols_5: 'md:grid-cols-5',
      cols_6: 'md:grid-cols-6',
      cols_7: 'md:grid-cols-7',
      cols_8: 'md:grid-cols-8',
      cols_9: 'md:grid-cols-9',
      cols_10: 'md:grid-cols-10',
      cols_11: 'md:grid-cols-11',
      cols_12: 'md:grid-cols-12',
    } satisfies Record<
      NonNullable<DisplaySettingValues['gridColumnsMd']>,
      string
    >,
    gridColumnsLg: {
      inherit: '',
      auto: 'lg:grid-cols-auto',
      none: 'lg:grid-cols-none',
      cols_1: 'lg:grid-cols-1',
      cols_2: 'lg:grid-cols-2',
      cols_3: 'lg:grid-cols-3',
      cols_4: 'lg:grid-cols-4',
      cols_5: 'lg:grid-cols-5',
      cols_6: 'lg:grid-cols-6',
      cols_7: 'lg:grid-cols-7',
      cols_8: 'lg:grid-cols-8',
      cols_9: 'lg:grid-cols-9',
      cols_10: 'lg:grid-cols-10',
      cols_11: 'lg:grid-cols-11',
      cols_12: 'lg:grid-cols-12',
    } satisfies Record<
      NonNullable<DisplaySettingValues['gridColumnsLg']>,
      string
    >,
    gridColumnsXl: {
      inherit: '',
      auto: 'xl:grid-cols-auto',
      none: 'xl:grid-cols-none',
      cols_1: 'xl:grid-cols-1',
      cols_2: 'xl:grid-cols-2',
      cols_3: 'xl:grid-cols-3',
      cols_4: 'xl:grid-cols-4',
      cols_5: 'xl:grid-cols-5',
      cols_6: 'xl:grid-cols-6',
      cols_7: 'xl:grid-cols-7',
      cols_8: 'xl:grid-cols-8',
      cols_9: 'xl:grid-cols-9',
      cols_10: 'xl:grid-cols-10',
      cols_11: 'xl:grid-cols-11',
      cols_12: 'xl:grid-cols-12',
    } satisfies Record<
      NonNullable<DisplaySettingValues['gridColumnsXl']>,
      string
    >,
    gridRows: {
      auto: '',
      none: 'grid-rows-none',
      rows_1: 'grid-rows-1',
      rows_2: 'grid-rows-2',
      rows_3: 'grid-rows-3',
      rows_4: 'grid-rows-4',
      rows_5: 'grid-rows-5',
      rows_6: 'grid-rows-6',
    } satisfies Record<NonNullable<DisplaySettingValues['gridRows']>, string>,
    justifyItems: {
      default: '',
      start: 'justify-items-start',
      center: 'justify-items-center',
      end: 'justify-items-end',
    } satisfies Record<
      NonNullable<DisplaySettingValues['justifyItems']>,
      string
    >,
    alignItems: {
      default: '',
      start: 'items-start',
      center: 'items-center',
      end: 'items-end',
      baseline: 'items-baseline',
    } satisfies Record<NonNullable<DisplaySettingValues['alignItems']>, string>,
    justifyContent: {
      default: '',
      center: 'justify-center',
      end: 'justify-end',
      between: 'justify-between',
      around: 'justify-around',
      evenly: 'justify-evenly',
    } satisfies Record<
      NonNullable<DisplaySettingValues['justifyContent']>,
      string
    >,
    alignContent: {
      default: '',
      center: 'content-center',
      end: 'content-end',
      between: 'content-between',
      around: 'content-around',
      evenly: 'content-evenly',
    } satisfies Record<
      NonNullable<DisplaySettingValues['alignContent']>,
      string
    >,
    gridAutoFlow: {
      row: '',
      col: 'grid-flow-col',
      dense: 'grid-flow-dense',
      row_dense: 'grid-flow-row-dense',
      col_dense: 'grid-flow-col-dense',
    } satisfies Record<
      NonNullable<DisplaySettingValues['gridAutoFlow']>,
      string
    >,
    spacing: {
      default: 'py-8',
      compact: 'py-4',
      loose: 'py-16',
      none: 'py-0',
    } satisfies Record<NonNullable<DisplaySettingValues['spacing']>, string>,
    background: {
      default: 'bg-transparent',
      light: 'bg-gray-50',
      dark: 'bg-gray-900 text-white',
      transparent: 'bg-transparent',
    } satisfies Record<NonNullable<DisplaySettingValues['background']>, string>,
  },
  defaultVariants: {
    displayMode: 'grid',
    spacing: 'default',
    background: 'default',
  },
})

export default function Row({
  displaySettings,
  className,
  children,
  preview,
  ...props
}: RowProps) {
  const displayMode = (getDisplayValue(displaySettings, 'displayMode') ||
    'grid') as DisplaySettingValues['displayMode']
  const isGridMode = displayMode === 'grid'

  const gapClasses = getGapClasses(displaySettings)

  return (
    <div
      className={cn(
        rowVariants({
          displayMode: displayMode as RowVariants['displayMode'],
          gridColumns: isGridMode
            ? (getDisplayValue(
                displaySettings,
                'gridColumns'
              ) as RowVariants['gridColumns'])
            : undefined,
          gridColumnsMd: isGridMode
            ? (getDisplayValue(
                displaySettings,
                'gridColumnsMd'
              ) as RowVariants['gridColumnsMd'])
            : undefined,
          gridColumnsLg: isGridMode
            ? (getDisplayValue(
                displaySettings,
                'gridColumnsLg'
              ) as RowVariants['gridColumnsLg'])
            : undefined,
          gridColumnsXl: isGridMode
            ? (getDisplayValue(
                displaySettings,
                'gridColumnsXl'
              ) as RowVariants['gridColumnsXl'])
            : undefined,
          gridRows: isGridMode
            ? (getDisplayValue(
                displaySettings,
                'gridRows'
              ) as RowVariants['gridRows'])
            : undefined,
          justifyItems: isGridMode
            ? (getDisplayValue(
                displaySettings,
                'justifyItems'
              ) as RowVariants['justifyItems'])
            : undefined,
          alignItems: getDisplayValue(
            displaySettings,
            'alignItems'
          ) as RowVariants['alignItems'],
          justifyContent: getDisplayValue(
            displaySettings,
            'justifyContent'
          ) as RowVariants['justifyContent'],
          alignContent: isGridMode
            ? (getDisplayValue(
                displaySettings,
                'alignContent'
              ) as RowVariants['alignContent'])
            : undefined,
          gridAutoFlow: isGridMode
            ? (getDisplayValue(
                displaySettings,
                'gridAutoFlow'
              ) as RowVariants['gridAutoFlow'])
            : undefined,
          spacing: getDisplayValue(
            displaySettings,
            'spacing'
          ) as RowVariants['spacing'],
          background: getDisplayValue(
            displaySettings,
            'background'
          ) as RowVariants['background'],
        }),
        ...gapClasses,
        draftClass(preview, 'vb:row'),
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
