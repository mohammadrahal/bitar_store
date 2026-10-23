'use client'

import { useId, useRef } from 'react'
import { useModalBehavior } from '@/hooks/use-modal-behavior'

export interface ConfirmOptions {
  title: string
  description: string
  confirmLabel?: string
  tone?: 'danger' | 'default'
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'default',
  onResolve,
}: ConfirmOptions & { onResolve: (confirmed: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()
  useModalBehavior(ref, () => onResolve(false))

  return (
    <div className="overlay overlay-center">
      <div className="overlay-backdrop" onClick={() => onResolve(false)} aria-hidden="true" />
      <div ref={ref} className="dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId}>
        <h2 id={titleId}>{title}</h2>
        <p id={descId}>{description}</p>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={() => onResolve(false)} data-autofocus>
            Cancel
          </button>
          <button type="button" className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`} onClick={() => onResolve(true)}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
