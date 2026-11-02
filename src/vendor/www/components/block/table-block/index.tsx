import { readFragment } from '../../../lib/optimizely/graphql'
import { TableBlockFragment, type TableBlockProps } from './types'

export { TableBlockFragment, type TableBlockProps }

const DARK_VARS = {
  '--prose-table-bg': 'var(--color-tertiary-midfir)',
  '--prose-table-text': 'var(--color-primary-1)',
  '--prose-table-row-odd': 'rgba(25, 112, 80, 0.7)',
  '--prose-table-row-even': 'rgba(25, 112, 80, 0.4)',
} as React.CSSProperties

const LIGHT_VARS = {
  '--prose-table-bg': 'var(--color-tertiary-4)',
  '--prose-table-text': 'var(--color-secondary-darkfir)',
  '--prose-table-row-odd': 'rgba(255, 255, 255, 0.7)',
  '--prose-table-row-even': 'rgba(255, 255, 255, 0.4)',
} as React.CSSProperties

function processTableHtml(html: string): string {
  return html
    .replace(/\{true\}/g, '<span data-table-icon="true"></span>')
    .replace(/\{false\}/g, '<span data-table-icon="false"></span>')
    .replace(/\{warning\}/g, '<span data-table-icon="warning"></span>')
    .replace(/\{cost\}/g, '<span data-table-icon="cost"></span>')
}

export default function TableBlock(props: TableBlockProps) {
  const { TableContent } = readFragment(TableBlockFragment, props)
  const { displaySettings } = props

  const { tableVariant } = displaySettings ?? {}

  const variant = tableVariant ?? 'dark'
  const html = TableContent?.html

  if (!html) return null

  const vars = variant === 'light' ? LIGHT_VARS : DARK_VARS
  const hasIcons =
    html.includes('{true}') ||
    html.includes('{false}') ||
    html.includes('{warning}') ||
    html.includes('{cost}')
  const processedHtml = hasIcons ? processTableHtml(html) : html

  return (
    <div className="overflow-x-auto" style={vars}>
      <div
        className={`prose max-w-none ${hasIcons ? 'table-with-icons' : ''}`}
        dangerouslySetInnerHTML={{ __html: processedHtml }}
      />
    </div>
  )
}
