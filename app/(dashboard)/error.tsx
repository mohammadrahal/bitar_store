'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { CircleAlert, RotateCw } from 'lucide-react'

/**
 * Catches a render or data failure inside the dashboard. It sits below the
 * layout, so the rail and the header stay on screen and the person can either
 * retry the segment or navigate away. rather than being dropped on Next's own
 * error page with the shell gone.
 */
export default function DashboardError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  /* A client error carries its own message; a server one is replaced with a
     digest, which is the only thing worth showing from it. */
  const detail =
    error instanceof Error && error.message
      ? error.message
      : 'The screen could not be rendered. Trying again often clears it.'
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined

  return (
    <div className="route-error">
      <span className="empty-icon" aria-hidden="true">
        <CircleAlert size={20} />
      </span>
      <h1>Something went wrong</h1>
      <p className="subtitle" role="alert">
        {detail}
      </p>
      <div className="route-error-actions">
        <button type="button" className="btn btn-primary" onClick={() => retry()}>
          <RotateCw size={16} aria-hidden="true" />
          Try again
        </button>
        <Link href="/dashboard" className="btn btn-secondary">
          Back to overview
        </Link>
      </div>
      {digest && <p className="route-error-digest tabular">Reference {digest}</p>}
    </div>
  )
}
