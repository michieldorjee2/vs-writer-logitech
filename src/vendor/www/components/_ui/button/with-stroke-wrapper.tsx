import type { ReactElement } from 'react'
import { StrokeButtonWrapper } from './stroke-wrapper'

const strokeBorderColors: Record<string, { color?: string; video?: boolean }> =
  {
    whiteStroke: { color: 'var(--color-tertiary-2)' },
    opalStroke: { video: true },
    darkStroke: { color: 'var(--color-secondary-darkfir)' },
  }

export function withStrokeWrapper(
  button: ReactElement,
  variant: string | undefined,
  size: 'sm' | 'default' | undefined,
  options?: { className?: string }
): ReactElement {
  const stroke = variant ? strokeBorderColors[variant] : undefined
  if (!stroke) return button
  return (
    <StrokeButtonWrapper
      size={size}
      borderColor={stroke.color}
      video={stroke.video}
      className={options?.className}
    >
      {button}
    </StrokeButtonWrapper>
  )
}
