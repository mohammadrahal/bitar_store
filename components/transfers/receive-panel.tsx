'use client'

import { useState } from 'react'
import { Field } from '@/components/shared/field'
import { Panel } from '@/components/shared/panel'
import { QuantityInput } from '@/components/shared/quantity-input'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { useReceiveTransfer } from '@/hooks/use-transfers'
import { lineInTransit } from '@/lib/transfers'
import type { TransferRow } from '@/types'

type Receipt = Record<string, { accepted: number; damaged: number }>

/** Partial receipts are normal: enter what arrived; damaged or wrong units go on hold at this location. */
export function ReceivePanel({ transfer, onDone }: { transfer: TransferRow; onDone: () => void }) {
  const receive = useReceiveTransfer()
  const idempotency = useIdempotencyKey()
  const lines = transfer.lines.filter((line) => lineInTransit(line) > 0)
  const [receipt, setReceipt] = useState<Receipt>(() =>
    Object.fromEntries(lines.map((line) => [line.variantId, { accepted: lineInTransit(line), damaged: 0 }])),
  )
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const damaged = Object.values(receipt).reduce((sum, entry) => sum + entry.damaged, 0)
  const total = Object.values(receipt).reduce((sum, entry) => sum + entry.accepted + entry.damaged, 0)
  const set = (variantId: string, field: 'accepted' | 'damaged', value: number) =>
    setReceipt((current) => ({ ...current, [variantId]: { ...current[variantId], [field]: value } }))

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (total === 0) return setError('Enter what arrived.')
    if (damaged > 0 && reason.trim().length < 3) return setError('Say what was wrong with the damaged or wrong units.')
    setError(null)
    receive.mutate(
      { id: transfer.id, receipt, reason, key: idempotency.current() },
      {
        onSuccess: () => {
          idempotency.reset()
          onDone()
        },
      },
    )
  }

  return (
    <Panel title="Receive" description={`Count what arrived at ${transfer.toName}. Whatever is not entered stays in transit.`}>
      <form className="panel-body stack" onSubmit={submit} noValidate>
        <ul className="sale-lines stacked">
          {lines.map((line) => {
            const transit = lineInTransit(line)
            const entry = receipt[line.variantId] ?? { accepted: 0, damaged: 0 }
            return (
              <li key={line.variantId}>
                <div className="sale-card-head">
                  <span>
                    <strong>
                      {line.productName} {line.color} / {line.size}
                    </strong>
                    <small className="tabular">{transit} in transit</small>
                  </span>
                </div>
                <QuantityInput
                  value={entry.accepted}
                  max={transit - entry.damaged}
                  capLabel="can be accepted"
                  label={`Accepted for ${line.color} / ${line.size}`}
                  onChange={(value) => set(line.variantId, 'accepted', value)}
                />
                <QuantityInput
                  value={entry.damaged}
                  max={transit - entry.accepted}
                  capLabel="left to mark damaged"
                  label={`Damaged or wrong for ${line.color} / ${line.size}`}
                  onChange={(value) => set(line.variantId, 'damaged', value)}
                />
              </li>
            )
          })}
        </ul>
        {damaged > 0 && (
          <Field label="What was wrong?" hint="Damaged or wrong units go on hold here, not into sellable stock.">
            <textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="row-actions">
          <button type="button" className="btn btn-secondary" onClick={onDone} disabled={receive.isPending}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={receive.isPending || total === 0}>
            {receive.isPending ? 'Saving…' : `Confirm receipt of ${total}`}
          </button>
        </div>
      </form>
    </Panel>
  )
}
