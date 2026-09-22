import { StrokeButtonWrapper } from './stroke-wrapper'

interface OpalButtonWrapperProps {
  children: React.ReactNode
  className?: string
  size?: 'sm' | 'default'
}

export function OpalButtonWrapper({
  children,
  className,
  size = 'default',
}: OpalButtonWrapperProps) {
  return (
    <StrokeButtonWrapper video size={size} className={className}>
      {children}
    </StrokeButtonWrapper>
  )
}
