'use client'

import { useId, useRef, useState } from 'react'
import { QuantityInput } from '@/components/shared/quantity-input'
import { useModalBehavior } from '@/hooks/use-modal-behavior'
import type { TransferLine } from '@/types'

/** Per-line quantities for approve and dispatch, each capped at what that step allows. */
export function LineQuantitiesDialog({
  title,
  description,
  confirmLabel,
  lines,
  capOf,
  capLabel,
  pending,
  onConfirm,
  onCancel,
}: {
  title: string
  description: string
  confirmLabel: string
  lines: TransferLine[]
  capOf: (line: TransferLine) => number
  capLabel: string
  pending: boolean
  onConfirm: (quantities: Record<string, number>) => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const open = lines.filter((line) => capOf(line) > 0)
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(open.map((line) => [line.variantId, capOf(line)])),
  )
  const total = Object.values(quantities).reduce((sum, value) => sum + value, 0)
  useModalBehavior(ref, onCancel)

  return (
    <div className="overlay overlay-center">
      <div className="overlay-backdrop" onClick={onCancel} aria-hidden="true" />
      <div ref={ref} className="dialog wide" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{title}</h2>
        <p>{description}</p>
        <form
          className="dialog-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            if (total > 0) onConfirm(quantities)
          }}
        >
          <ul className="sale-lines stacked">
            {open.map((line) => (
              <li key={line.variantId}>
                <div className="sale-card-head">
                  <span>
                    <strong>
                      {line.productName} {line.color} / {line.size}
                    </strong>
                    <small className="tabular">{line.sku}</small>
                  </span>
                </div>
                <QuantityInput
                  value={quantities[line.variantId] ?? 0}
                  max={capOf(line)}
                  capLabel={capLabel}
                  label={`Quantity for ${line.color} / ${line.size}`}
                  onChange={(value) => setQuantities((current) => ({ ...current, [line.variantId]: value }))}
                />
              </li>
            ))}
          </ul>
          <div className="dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={pending}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={pending || total === 0}>
              {pending ? 'Saving…' : `${confirmLabel} ${total}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
