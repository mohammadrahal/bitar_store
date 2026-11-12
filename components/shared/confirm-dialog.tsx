'use client'

import { useCallback, useId, useRef, useState } from 'react'
import { useModalBehavior } from '@/hooks/use-modal-behavior'

export interface ConfirmOptions {
  title: string
  description: string
  confirmLabel?: string
  /** The dismiss button. Rename it when the action itself is a cancel. */
  cancelLabel?: string
  tone?: 'danger' | 'default'
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
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
            {cancelLabel}
          </button>
          <button type="button" className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`} onClick={() => onResolve(true)}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * `const [confirm, confirmDialog] = useConfirm()`, render `confirmDialog`, then
 * `if (await confirm({...})) doIt()`. Saves each screen its own open state.
 */
export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, React.ReactNode] {
  const [pending, setPending] = useState<{ options: ConfirmOptions; resolve: (confirmed: boolean) => void } | null>(
    null,
  )
  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ options, resolve })),
    [],
  )
  const dialog = pending ? (
    <ConfirmDialog
      {...pending.options}
      onResolve={(confirmed) => {
        pending.resolve(confirmed)
        setPending(null)
      }}
    />
  ) : null
  return [confirm, dialog]
}
