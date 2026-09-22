import { lazy, Suspense, type ComponentProps, type ReactNode } from 'react'
import { cva } from 'class-variance-authority'
import Row from '@/components/layout/row'
import Column from '@/components/layout/column'
import { BlankSection as BlankSectionGQLProps } from '@/lib/optimizely/types/generated'
import { cn, getDisplayValue } from '@/lib/utils'
import type {
  Row as RowType,
  Column as ColumnType,
} from '@/lib/optimizely/types/experience'
import type { BlankSectionProps, DisplaySettingValues } from './types'

const LazyContentAreaMapper = lazy(
  () => import('@/lib/optimizely/rendering/content-area/mapper')
)

function ContentAreaMapper(props: ComponentProps<typeof LazyContentAreaMapper>) {
  return (
    <Suspense fallback={null}>
      <LazyContentAreaMapper {...props} />
    </Suspense>
  )
}

interface BlankSectionWithRows
  extends Partial<BlankSectionGQLProps>,
    BlankSectionProps {
  rows?: RowType[]
  children?: ReactNode
  className?: string
  preview?: boolean
}

export const blankSectionVariants = cva('relative flex w-full flex-col', {
  variants: {
    backgroundColor: {
      transparent: 'bg-transparent',
      white: 'bg-primary-1',
      light_gray: 'bg-tertiary-2',
      light_green: 'bg-primary-lfgreen',
      light_teal: 'bg-secondary-ltblue',
      dark_forest: 'bg-secondary-darkfir text-white',
    } satisfies Record<
      NonNullable<DisplaySettingValues['backgroundColor']>,
      string
    >,
    paddingY: {
      none: 'py-0',
      compact: 'py-4',
      default: 'py-8',
      loose: 'py-16',
      extra_loose: 'py-24',
    } satisfies Record<NonNullable<DisplaySettingValues['paddingY']>, string>,
    paddingX: {
      none: 'px-0',
      compact: 'px-4',
      default: 'px-8',
      loose: 'px-16',
    } satisfies Record<NonNullable<DisplaySettingValues['paddingX']>, string>,
    roundedCorners: {
      all: 'rounded-[24px] lg:rounded-[35px]',
      top: 'rounded-t-[24px] lg:rounded-t-[35px]',
      bottom: 'rounded-b-[24px] lg:rounded-b-[35px]',
      none: '',
    } satisfies Record<
      NonNullable<DisplaySettingValues['roundedCorners']>,
      string
    >,
    marginTop: {
      negative_lg: '-mt-10',
      negative_md: '-mt-6',
      negative_sm: '-mt-4',
      none: 'mt-0',
      sm: 'mt-4',
      md: 'mt-6',
      lg: 'mt-8',
      xl: 'mt-12',
      m_2xl: 'mt-16',
      m_3xl: 'mt-24',
      m_4xl: 'mt-32',
    } satisfies Record<NonNullable<DisplaySettingValues['marginTop']>, string>,
    marginBottom: {
      negative_lg: '-mb-10',
      negative_md: '-mb-6',
      negative_sm: '-mb-4',
      none: 'mb-0',
      sm: 'mb-4',
      md: 'mb-6',
      lg: 'mb-8',
      xl: 'mb-12',
      m_2xl: 'mb-16',
      m_3xl: 'mb-24',
      m_4xl: 'mb-32',
    } satisfies Record<
      NonNullable<DisplaySettingValues['marginBottom']>,
      string
    >,
  },
  defaultVariants: {
    backgroundColor: 'transparent',
    paddingY: 'none',
    paddingX: 'none',
    roundedCorners: 'none',
    marginTop: 'none',
    marginBottom: 'none',
  },
})

export default function BlankSection({
  rows,
  displaySettings,
  children,
  className,
  preview,
}: BlankSectionWithRows) {
  const hasRows = rows && rows.length > 0

  if (!hasRows && !children) {
    return null
  }

  const containerWidth = (getDisplayValue(displaySettings, 'containerWidth') ||
    'full') as DisplaySettingValues['containerWidth']
  const backgroundColor = getDisplayValue(
    displaySettings,
    'backgroundColor'
  ) as DisplaySettingValues['backgroundColor']
  const paddingY = getDisplayValue(
    displaySettings,
    'paddingY'
  ) as DisplaySettingValues['paddingY']
  const paddingX = getDisplayValue(
    displaySettings,
    'paddingX'
  ) as DisplaySettingValues['paddingX']
  const roundedCorners = getDisplayValue(
    displaySettings,
    'roundedCorners'
  ) as DisplaySettingValues['roundedCorners']
  const marginTop = getDisplayValue(
    displaySettings,
    'marginTop'
  ) as DisplaySettingValues['marginTop']
  const marginBottom = getDisplayValue(
    displaySettings,
    'marginBottom'
  ) as DisplaySettingValues['marginBottom']

  const content = hasRows
    ? rows.map((row: RowType) => (
        <Row
          key={row.key}
          displaySettings={row.displaySettings}
          preview={preview}
        >
          {row.columns?.map((column: ColumnType) => (
            <Column
              key={column.key}
              displaySettings={column.displaySettings}
              preview={preview}
            >
              <ContentAreaMapper
                experienceElements={column.elements}
                isVisualBuilder
                preview={preview}
              />
            </Column>
          ))}
        </Row>
      ))
    : children

  const styledSection = (
    <div
      className={cn(
        blankSectionVariants({
          backgroundColor,
          paddingY,
          paddingX,
          roundedCorners,
          marginTop,
          marginBottom,
        }),
        className
      )}
    >
      {containerWidth === 'contained' ? (
        <div className="container mx-auto">{content}</div>
      ) : (
        content
      )}
    </div>
  )

  if (containerWidth === 'contained_bg') {
    return <div className="container mx-auto">{styledSection}</div>
  }

  return styledSection
}
