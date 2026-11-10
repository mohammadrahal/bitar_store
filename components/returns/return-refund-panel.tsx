'use client'

import { useState } from 'react'
import { Field } from '@/components/shared/field'
import { Panel } from '@/components/shared/panel'
import { SelectInput } from '@/components/shared/select-input'
import { useCurrentCashSession } from '@/hooks/use-cash-sessions'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { usePayReturnRefund } from '@/hooks/use-returns'
import { useSettings } from '@/hooks/use-settings'
import { priceOf } from '@/lib/api/map-catalog'
import { formatPrice, formatRelativeDateTime } from '@/lib/format'
import { MAX_CASH_TENDERED, parseMoneyInput } from '@/lib/input-limits'
import { refundOutstanding } from '@/services/returns.service'
import type { ApiReturn } from '@/lib/api/types'

/**
 * Step 4 of 4: handing the money back.
 *
 * The refund was fixed when the manager approved; this only pays it, in one go
 * or in parts. `outstanding` comes from the server and the server refuses a
 * penny more, so the amount box is seeded with it and capped by it rather than
 * computed here.
 *
 * **Cash comes out of this branch's open drawer.** With `requireOpenCashSession`
 * on and no drawer open the server answers 409, so the panel says so before the
 * attempt — a cashier counting out notes should not learn from a failed request
 * that the till was never opened. Whish never touches the drawer, so it stays
 * available either way.
 */
export function ReturnRefundPanel({ entry, canPay }: { entry: ApiReturn; canPay: boolean }) {
  const pay = usePayReturnRefund()
  const idempotency = useIdempotencyKey()
  const settings = useSettings()
  const drawer = useCurrentCashSession(entry.receivingBranch.id)

  const outstanding = refundOutstanding(entry)
  const [method, setMethod] = useState<'cash' | 'whish'>('cash')
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [reference, setReference] = useState('')

  const refund = entry.refund
  if (!refund) return null

  const typed = amount.trim()
  const value = typed === '' ? outstanding : parseMoneyInput(typed, MAX_CASH_TENDERED)
  const tooMuch = value > outstanding + 0.0001
  const settled = refund.status === 'paid' || outstanding === 0

  /* Only a *cash* refund needs the drawer, and only when the shop requires a
     session at all. A failed read says nothing either way, so it does not
     block: the 409 would explain itself. */
  const drawerRequired = settings.data?.requireOpenCashSession ?? false
  const drawerMissing =
    method === 'cash' && drawerRequired && !drawer.isPending && !drawer.isError && drawer.data === null

  const ready =
    canPay &&
    !settled &&
    !tooMuch &&
    value > 0 &&
    recipient.trim().length >= 2 &&
    !drawerMissing &&
    !pay.isPending

  return (
    <Panel
      title="Refund"
      description={
        settled
          ? 'Paid in full. Nothing further is owed on this return.'
          : `${formatPrice(outstanding)} of ${formatPrice(priceOf(refund.total))} is still owed. It can be paid in parts.`
      }
    >
      <div className="panel-body stack gap-md">
        {refund.payments.length > 0 && (
          <div className="table-wrap">
            <table className="card-table">
              <caption className="sr-only">Refund payments, oldest first</caption>
              <thead>
                <tr>
                  <th scope="col">Paid to</th>
                  <th scope="col">How</th>
                  <th scope="col" className="num">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {refund.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="card-title">
                      {payment.recipient}
                      <small>
                        {formatRelativeDateTime(payment.at)} · by {payment.by.name ?? 'Unknown'}
                        {payment.reference ? ` · ${payment.reference}` : ''}
                      </small>
                    </td>
                    <td className="capitalize" data-label="How">
                      {payment.method}
                    </td>
                    <td className="num tabular" data-label="Amount">
                      {formatPrice(priceOf(payment.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {settled ? null : !canPay ? (
          <p className="muted text-sm" style={{ margin: 0 }}>
            Paying a refund needs the refunds permission. Ask a manager to hand the money back.
          </p>
        ) : (
          <div className="stack gap-md" style={{ maxWidth: '32rem' }}>
            <Field label="How it is paid" hint="A refund goes back the way the sale was paid.">
              <SelectInput
                value={method}
                onValueChange={(next) => {
                  setMethod(next as 'cash' | 'whish')
                  /* A reference belongs to Whish only — the server rejects one
                     on a cash refund outright. */
                  if (next === 'cash') setReference('')
                }}
                aria-label="How the refund is paid"
                disabled={pay.isPending}
                options={[
                  { value: 'cash', label: 'Cash' },
                  { value: 'whish', label: 'Whish' },
                ]}
              />
            </Field>

            {drawerMissing ? (
              <div className="cash-gate" role="status">
                <div className="cash-gate-copy">
                  <strong>No cash drawer is open at {entry.receivingBranch.name}.</strong>
                  <p>
                    A cash refund comes out of the open drawer, so this one cannot be paid until
                    someone opens it. Whish does not need the drawer.
                  </p>
                </div>
              </div>
            ) : null}

            <Field
              label="Amount"
              hint={`At most ${formatPrice(outstanding)}. Leave it empty to pay all of it.`}
              error={tooMuch ? `More than is owed. ${formatPrice(outstanding)} is left.` : undefined}
            >
              <input
                type="text"
                inputMode="decimal"
                className="tabular"
                value={amount}
                placeholder={outstanding.toFixed(2)}
                disabled={pay.isPending}
                onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ''))}
              />
            </Field>

            <Field label="Paid to" hint="Who is taking the money. 2 to 100 characters.">
              <input
                type="text"
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                maxLength={100}
                disabled={pay.isPending}
              />
            </Field>

            {method === 'whish' ? (
              <Field label="Whish reference (optional)" hint="The transfer reference, if there is one.">
                <input
                  type="text"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  maxLength={64}
                  disabled={pay.isPending}
                />
              </Field>
            ) : null}

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!ready}
                onClick={() =>
                  pay.mutate(
                    {
                      id: entry.id,
                      method,
                      amount: value,
                      recipient: recipient.trim(),
                      reference: reference.trim() || undefined,
                      idempotencyKey: idempotency.current(),
                    },
                    {
                      onSuccess: () => {
                        idempotency.reset()
                        setAmount('')
                        setReference('')
                      },
                    },
                  )
                }
              >
                {pay.isPending ? 'Paying…' : `Hand back ${formatPrice(value)}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}
