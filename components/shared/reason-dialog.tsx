'use client'

import { useId, useRef, useState } from 'react'
import { useModalBehavior } from '@/hooks/use-modal-behavior'

/**
 * Confirm step for anything that writes stock off or reverses a promise:
 * disposal, negative corrections, cancellations, discrepancies. The reason is
 * required and travels with the change.
 */
export function ReasonDialog({
  title,
  description,
  confirmLabel,
  reasonLabel = 'Reason',
  placeholder,
  tone = 'danger',
  pending = false,
  children,
  onConfirm,
  onCancel,
}: {
  title: string
  description: string
  confirmLabel: string
  reasonLabel?: string
  placeholder?: string
  tone?: 'danger' | 'default'
  pending?: boolean
  children?: React.ReactNode
  onConfirm: (reason: string) => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const fieldId = useId()
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const invalid = reason.trim().length < 3
  useModalBehavior(ref, onCancel)

  return (
    <div className="overlay overlay-center">
      <div className="overlay-backdrop" onClick={onCancel} aria-hidden="true" />
      <div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{title}</h2>
        <p>{description}</p>
        <form
          className="dialog-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            setTouched(true)
            if (!invalid) onConfirm(reason.trim())
          }}
        >
          {children}
          <div className="field">
            <label htmlFor={fieldId}>{reasonLabel}</label>
            <textarea
              id={fieldId}
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={placeholder}
              aria-invalid={touched && invalid ? true : undefined}
              aria-describedby={touched && invalid ? `${fieldId}-error` : undefined}
              data-autofocus
            />
            {touched && invalid && (
              <span id={`${fieldId}-error`} className="field-error">
                Give a reason of at least 3 characters.
              </span>
            )}
          </div>
          <div className="dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={pending}>
              Cancel
            </button>
            <button type="submit" className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`} disabled={pending}>
              {pending ? 'Saving…' : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
