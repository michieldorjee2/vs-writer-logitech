import { StackedHeading } from '../../element/stacked-heading-element'
import { parseBoolean } from '../../../lib/optimizely/types/display-settings'
import { cn } from '../../../lib/utils'
import {
  StatBlockFragment,
  type StatBlockProps,
  type AnimationMode,
} from './types'

export { StatBlockFragment, type StatBlockProps }

export default function StatBlock({
  StatValue,
  StatDescription,
  displaySettings,
}: StatBlockProps) {
  if (!StatValue) {
    return null
  }
  const { alignment, heightSpan, animationMode, extrusionCount } =
    displaySettings ?? {}

  const isHorizontal = alignment === 'horizontal'
  const fillHeight = parseBoolean(heightSpan)
  const mode = (animationMode as AnimationMode) || 'none'
  const layers = extrusionCount
    ? parseInt(extrusionCount.replace('layers_', ''), 10)
    : 5

  return (
    <div
      className={cn(
        '@container',
        fillHeight && 'h-full',
        isHorizontal && 'w-full'
      )}
    >
      <div
        className={cn(
          'rounded-3xl bg-(--color-neutral-2)',
          fillHeight && 'h-full',
          isHorizontal
            ? 'flex items-end gap-6 p-8 @[400px]:gap-12'
            : 'flex flex-col items-start px-5 py-6 @[400px]:p-8'
        )}
      >
        <StackedHeading
          text={`##${StatValue}##`}
          as="span"
          animationMode={mode}
          extrusionCount={layers}
          className={cn(
            'leading-[0.9]',
            'pt-4 pr-4 @[400px]:pt-6 @[400px]:pr-6',
            isHorizontal
              ? '@[400px]:text-extruded-sm w-auto shrink-0 text-[44px]'
              : '@[400px]:text-11xl text-[44px]'
          )}
        />
        {StatDescription && (
          <p
            className={cn(
              'font-body font-medium text-(--color-secondary-darkfir)',
              isHorizontal
                ? 'text-body-xs/snug @[400px]:text-body-med/snug min-w-0 flex-1 text-right wrap-break-word'
                : 'text-body-xs/snug @[400px]:text-body-base/tight mt-6 @[400px]:mt-12'
            )}
          >
            {StatDescription}
          </p>
        )}
      </div>
    </div>
  )
}
