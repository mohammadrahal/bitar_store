'use client'

import { useState } from 'react'
import { Drawer } from '@/components/shared/drawer'
import { Field } from '@/components/shared/field'
import { useReviewReplenishmentRequest } from '@/hooks/use-replenishment-requests'
import { formatRelativeDateTime } from '@/lib/format'
import type { ReplenishmentRequestRow } from '@/types'

/**
 * Approve a request whole, cut any line back, or approve nothing — which is a
 * rejection and needs a reason (BL-05).
 */
export function ReplenishmentReviewForm({
  request,
  onClose,
}: {
  request: ReplenishmentRequestRow
  onClose: () => void
}) {
  const review = useReviewReplenishmentRequest()
  const [approved, setApproved] = useState<Record<string, number>>(
    Object.fromEntries(request.lines.map((line) => [line.variantId, line.requested])),
  )
  const [reason, setReason] = useState('')

  const total = Object.values(approved).reduce((sum, quantity) => sum + quantity, 0)
  const isRejection = total === 0

  const submit = () =>
    review.mutate({ requestId: request.id, approved, reason }, { onSuccess: onClose })

  return (
    <Drawer
      eyebrow={request.number}
      title={`Review ${request.branchName}`}
      description={`${request.requestedBy} asked ${formatRelativeDateTime(request.requestedAt)}: ${request.reason}`}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={review.isPending}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={review.isPending || (isRejection && reason.trim() === '')}
          >
            {review.isPending ? 'Saving…' : isRejection ? 'Reject request' : `Approve ${total}`}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="table-wrap full">
          <table className="card-table">
            <caption className="sr-only">Approved quantity per variant</caption>
            <thead>
              <tr>
                <th scope="col">Variant</th>
                <th scope="col" className="num">
                  Asked
                </th>
                <th scope="col" className="num">
                  Approve
                </th>
              </tr>
            </thead>
            <tbody>
              {request.lines.map((line) => (
                <tr key={line.variantId}>
                  <td className="card-title" data-label="Variant">
                    {line.label}
                    <small>{line.sku}</small>
                  </td>
                  <td className="num tabular" data-label="Asked">
                    {line.requested}
                  </td>
                  <td className="num" data-label="Approve">
                    <input
                      className="qty-input tabular"
                      type="number"
                      min={0}
                      max={line.requested}
                      step={1}
                      value={approved[line.variantId] ?? 0}
                      aria-label={`Approved units of ${line.sku}`}
                      onChange={(event) => {
                        const parsed = Math.floor(Number(event.target.value))
                        const capped = Number.isFinite(parsed) ? Math.min(line.requested, Math.max(0, parsed)) : 0
                        setApproved((current) => ({ ...current, [line.variantId]: capped }))
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Field
          label={isRejection ? 'Reason for rejecting' : 'Note (optional)'}
          className="full"
          hint={isRejection ? 'Required: the branch needs to know why.' : 'Shown with the decision.'}
        >
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            autoComplete="off"
            placeholder={isRejection ? 'Warehouse has none to spare' : ''}
          />
        </Field>
      </div>
    </Drawer>
  )
}
