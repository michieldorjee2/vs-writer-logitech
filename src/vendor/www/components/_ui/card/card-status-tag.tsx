import { Badge } from '../badge'
import { cn } from '../../../lib/utils'

const BADGE_CONFIG = {
  certified: { icon: 'award_star', label: 'Optimizely certified' },
  verified: { icon: 'check_circle', label: 'Optimizely verified' },
  partner: { icon: 'engineering', label: 'Developed by partner' },
} as const

export type BadgeVariant = keyof typeof BADGE_CONFIG

interface CardStatusTagProps {
  badge: BadgeVariant
  colorScheme?: 'dark' | 'light'
  className?: string
}

export function CardStatusTag({
  badge,
  colorScheme = 'dark',
  className,
}: CardStatusTagProps) {
  const config = BADGE_CONFIG[badge]

  return (
    <Badge
      label={config.label}
      iconName={config.icon}
      color={colorScheme === 'dark' ? 'darkgreen' : 'neutral'}
      filled={false}
      size="md"
      className={cn('self-start border-transparent', className)}
    />
  )
}
