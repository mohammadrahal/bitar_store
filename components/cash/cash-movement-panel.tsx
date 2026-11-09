'use client'

import { useState } from 'react'
import { Field } from '@/components/shared/field'
import { Panel } from '@/components/shared/panel'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { useRecordCashMovement } from '@/hooks/use-cash-sessions'
import { cashSessionTotals } from '@/lib/cash-display'
import { priceOf } from '@/lib/api/map-catalog'
import { formatPrice, formatRelativeDateTime } from '@/lib/format'
import { MAX_CASH_TENDERED, parseMoneyInput } from '@/lib/input-limits'
import type { ApiCashSession, CashMovementDirection } from '@/lib/api/types'

const DIRECTIONS: { value: CashMovementDirection; label: string }[] = [
  { value: 'out', label: 'Out of the drawer' },
  { value: 'in', label: 'Into the drawer' },
]

/**
 * Cash in or out, away from a sale: a float topped up, a delivery driver paid,
 * a drop to the safe.
 *
 * The reason is required by this form rather than by the server alone, because
 * a movement with no reason is exactly the entry that makes a closing
 * impossible to explain the next morning. Taking out more than the drawer is
 * expected to hold is a **409** — the server names the figure, so its own
 * message is shown rather than one written here.
 */
export function CashMovementPanel({ session, canMove }: { session: ApiCashSession; canMove: boolean }) {
  const record = useRecordCashMovement()
  const idempotency = useIdempotencyKey()
  const [direction, setDirection] = useState<CashMovementDirection>('out')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const typed = amount.trim()
  const value = typed === '' ? null : parseMoneyInput(typed, MAX_CASH_TENDERED)
  const expected = priceOf(cashSessionTotals(session).expectedCash)
  const overdrawn = direction === 'out' && value !== null && value > expected
  const ready = value !== null && value > 0 && reason.trim().length > 0 && !overdrawn

  const submit = () => {
    if (!ready || value === null) return
    record.mutate(
      { id: session.id, direction, amount: value, reason, idempotencyKey: idempotency.current() },
      {
        onSuccess: () => {
          idempotency.reset()
          setAmount('')
          setReason('')
        },
      },
    )
  }

  const movements = [...session.movements].reverse()

  return (
    <Panel
      title="Cash in and out"
      description="Money that moves without a sale. Each entry is recorded under your name."
    >
      {canMove ? (
        <form
          className="panel-body stack gap-md"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <div className="segmented compact" role="radiogroup" aria-label="Direction">
            {DIRECTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={direction === option.value}
                className={direction === option.value ? 'active' : ''}
                onClick={() => setDirection(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="form-grid">
            <Field
              label="Amount"
              hint={direction === 'out' ? `At most ${formatPrice(expected)} is in the drawer.` : undefined}
              error={overdrawn ? `The drawer is only expected to hold ${formatPrice(expected)}.` : undefined}
            >
              <input
                type="text"
                inputMode="decimal"
                className="tabular"
                value={amount}
                placeholder="0.00"
                onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ''))}
              />
            </Field>
            <Field label="Reason" hint="Required. Say what the money was for.">
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={direction === 'out' ? 'Paid the courier' : 'Extra float from the safe'}
                autoComplete="off"
              />
            </Field>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-secondary" disabled={record.isPending || !ready}>
              {record.isPending
                ? 'Recording…'
                : direction === 'out'
                  ? 'Record cash out'
                  : 'Record cash in'}
            </button>
          </div>
        </form>
      ) : (
        <p className="panel-body muted">
          You do not have the permission to move cash in or out of the drawer. A manager can.
        </p>
      )}

      {movements.length > 0 && (
        <div className="table-wrap">
          <table className="card-table">
            <caption className="sr-only">Cash movements on this session, newest first</caption>
            <thead>
              <tr>
                <th scope="col">Reason</th>
                <th scope="col">By</th>
                <th scope="col" className="num">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement) => (
                <tr key={movement.id}>
                  <td className="card-title">
                    {movement.reason}
                    <small>{formatRelativeDateTime(movement.at)}</small>
                  </td>
                  <td>{movement.by.name ?? 'Unknown'}</td>
                  <td className={`num tabular ${movement.direction === 'out' ? 'detail-alert' : ''}`}>
                    {movement.direction === 'out' ? '−' : '+'}
                    {formatPrice(priceOf(movement.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
