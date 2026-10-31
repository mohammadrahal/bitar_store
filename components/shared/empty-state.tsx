import type { LucideIcon } from 'lucide-react'
import { FadeIn } from '@/components/motion/fade-in'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <FadeIn className="empty-state">
      <span className="empty-icon" aria-hidden="true">
        <Icon size={20} />
      </span>
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </FadeIn>
  )
}
