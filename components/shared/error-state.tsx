import type { ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'

export function ErrorState({
  title = 'Something went wrong',
  error,
  detail,
  onRetry,
}: {
  title?: string
  error: unknown
  detail?: ReactNode
  onRetry?: () => void
}) {
  const message = error instanceof Error ? error.message : 'Please try again.'
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true">
        <CircleAlert size={20} />
      </span>
      <strong>{title}</strong>
      <p role="alert">{message}</p>
      {detail ? <p className="muted">{detail}</p> : null}
      {onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
