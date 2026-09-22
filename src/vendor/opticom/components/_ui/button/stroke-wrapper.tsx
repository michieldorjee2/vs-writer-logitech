import { cn } from '@/lib/utils'

interface StrokeButtonWrapperProps {
  children: React.ReactNode
  className?: string
  size?: 'sm' | 'default'
  borderColor?: string
  video?: boolean
}

const ringMask = {
  maskImage: 'linear-gradient(#000 0 0), linear-gradient(#000 0 0)',
  maskClip: 'content-box, border-box',
  maskOrigin: 'content-box, border-box',
  maskComposite: 'exclude',
  WebkitMaskImage: 'linear-gradient(#000 0 0), linear-gradient(#000 0 0)',
  WebkitMaskClip: 'content-box, border-box',
  WebkitMaskOrigin: 'content-box, border-box',
  WebkitMaskComposite: 'xor',
} as React.CSSProperties

export function StrokeButtonWrapper({
  children,
  className,
  size = 'default',
  borderColor,
  video = false,
}: StrokeButtonWrapperProps) {
  const outerRadius =
    size === 'sm'
      ? 'rounded-[calc(var(--radius-cta-sml)+2px)]'
      : 'rounded-[22px]'

  return (
    <span className={cn('group/stroke relative inline-flex', className)}>
      <span
        className={cn(
          'absolute -inset-0.5 overflow-hidden transition-[padding]',
          'p-0.5 group-hover/stroke:pt-0.25 group-hover/stroke:pr-0.25 group-hover/stroke:pb-1 group-hover/stroke:pl-1',
          'group-active/stroke:p-0.5',
          outerRadius
        )}
        style={{
          ...ringMask,
          ...(borderColor ? { backgroundColor: borderColor } : {}),
        }}
      >
        {video && (
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 size-full object-cover"
            src="/assets/Slow_2.5m.mp4"
          />
        )}
      </span>
      {children}
    </span>
  )
}
