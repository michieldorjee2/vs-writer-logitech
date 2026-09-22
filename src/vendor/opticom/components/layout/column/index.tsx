import { cva } from 'class-variance-authority'
import { cn, getDisplayValue } from '@/lib/utils'
import { draftClass } from '@/lib/utils/draft-helpers'
import type { ColumnProps, DisplaySettingValues, ColumnVariants } from './types'

export const columnVariants = cva(
  'flex flex-1 flex-col flex-nowrap justify-start',
  {
    variants: {
      colSpan: {
        auto: '',
        full: 'col-span-full',
        span_1: 'col-span-1',
        span_2: 'col-span-2',
        span_3: 'col-span-3',
        span_4: 'col-span-4',
        span_5: 'col-span-5',
        span_6: 'col-span-6',
        span_7: 'col-span-7',
        span_8: 'col-span-8',
        span_9: 'col-span-9',
        span_10: 'col-span-10',
        span_11: 'col-span-11',
        span_12: 'col-span-12',
      } satisfies Record<NonNullable<DisplaySettingValues['colSpan']>, string>,
      colStart: {
        auto: '',
        start_1: 'col-start-1',
        start_2: 'col-start-2',
        start_3: 'col-start-3',
        start_4: 'col-start-4',
        start_5: 'col-start-5',
        start_6: 'col-start-6',
        start_7: 'col-start-7',
        start_8: 'col-start-8',
        start_9: 'col-start-9',
        start_10: 'col-start-10',
        start_11: 'col-start-11',
        start_12: 'col-start-12',
        start_13: 'col-start-13',
      } satisfies Record<NonNullable<DisplaySettingValues['colStart']>, string>,
      colEnd: {
        auto: '',
        end_1: 'col-end-1',
        end_2: 'col-end-2',
        end_3: 'col-end-3',
        end_4: 'col-end-4',
        end_5: 'col-end-5',
        end_6: 'col-end-6',
        end_7: 'col-end-7',
        end_8: 'col-end-8',
        end_9: 'col-end-9',
        end_10: 'col-end-10',
        end_11: 'col-end-11',
        end_12: 'col-end-12',
        end_13: 'col-end-13',
      } satisfies Record<NonNullable<DisplaySettingValues['colEnd']>, string>,
      rowSpan: {
        auto: '',
        full: 'row-span-full',
        row_span_1: 'row-span-1',
        row_span_2: 'row-span-2',
        row_span_3: 'row-span-3',
        row_span_4: 'row-span-4',
        row_span_5: 'row-span-5',
        row_span_6: 'row-span-6',
      } satisfies Record<NonNullable<DisplaySettingValues['rowSpan']>, string>,
      rowStart: {
        auto: '',
        row_start_1: 'row-start-1',
        row_start_2: 'row-start-2',
        row_start_3: 'row-start-3',
        row_start_4: 'row-start-4',
        row_start_5: 'row-start-5',
        row_start_6: 'row-start-6',
        row_start_7: 'row-start-7',
      } satisfies Record<NonNullable<DisplaySettingValues['rowStart']>, string>,
      rowEnd: {
        auto: '',
        row_end_1: 'row-end-1',
        row_end_2: 'row-end-2',
        row_end_3: 'row-end-3',
        row_end_4: 'row-end-4',
        row_end_5: 'row-end-5',
        row_end_6: 'row-end-6',
        row_end_7: 'row-end-7',
      } satisfies Record<NonNullable<DisplaySettingValues['rowEnd']>, string>,
      justifySelf: {
        auto: '',
        start: 'justify-self-start',
        center: 'justify-self-center',
        end: 'justify-self-end',
        stretch: 'justify-self-stretch',
      } satisfies Record<
        NonNullable<DisplaySettingValues['justifySelf']>,
        string
      >,
      alignSelf: {
        auto: '',
        start: 'self-start',
        center: 'self-center',
        end: 'self-end',
        stretch: 'self-stretch',
        baseline: 'self-baseline',
      } satisfies Record<
        NonNullable<DisplaySettingValues['alignSelf']>,
        string
      >,
      order: {
        none: '',
        first: 'order-first',
        last: 'order-last',
        order_1: 'order-1',
        order_2: 'order-2',
        order_3: 'order-3',
        order_4: 'order-4',
        order_5: 'order-5',
        order_6: 'order-6',
        order_7: 'order-7',
        order_8: 'order-8',
        order_9: 'order-9',
        order_10: 'order-10',
        order_11: 'order-11',
        order_12: 'order-12',
      } satisfies Record<NonNullable<DisplaySettingValues['order']>, string>,
    },
  }
)

export default function Column({
  displaySettings,
  className,
  children,
  preview,
  ...props
}: ColumnProps) {
  const customClassName = getDisplayValue(displaySettings, 'className')

  return (
    <div
      className={cn(
        columnVariants({
          colSpan: getDisplayValue(
            displaySettings,
            'colSpan'
          ) as ColumnVariants['colSpan'],
          colStart: getDisplayValue(
            displaySettings,
            'colStart'
          ) as ColumnVariants['colStart'],
          colEnd: getDisplayValue(
            displaySettings,
            'colEnd'
          ) as ColumnVariants['colEnd'],
          rowSpan: getDisplayValue(
            displaySettings,
            'rowSpan'
          ) as ColumnVariants['rowSpan'],
          rowStart: getDisplayValue(
            displaySettings,
            'rowStart'
          ) as ColumnVariants['rowStart'],
          rowEnd: getDisplayValue(
            displaySettings,
            'rowEnd'
          ) as ColumnVariants['rowEnd'],
          justifySelf: getDisplayValue(
            displaySettings,
            'justifySelf'
          ) as ColumnVariants['justifySelf'],
          alignSelf: getDisplayValue(
            displaySettings,
            'alignSelf'
          ) as ColumnVariants['alignSelf'],
          order: getDisplayValue(
            displaySettings,
            'order'
          ) as ColumnVariants['order'],
        }),
        draftClass(preview, 'vb:col'),
        customClassName,
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
