'use client'

import { useState } from 'react'
import { Field } from '@/components/shared/field'
import { Panel } from '@/components/shared/panel'
import { CashCountField } from '@/components/cash/cash-count-field'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { useCloseCashSession } from '@/hooks/use-cash-sessions'
import { cashSessionTotals } from '@/lib/cash-display'
import { needsDifferenceNote } from '@/services/cash-sessions.service'
import { priceOf } from '@/lib/api/map-catalog'
import { formatPrice } from '@/lib/format'
import { MAX_CASH_TENDERED, parseMoneyInput } from '@/lib/input-limits'
import type { ApiCashSession } from '@/lib/api/types'

/**
 * Closing the drawer at the end of the day.
 *
 * **A difference never blocks the closing.** It requires a note, and the
 * session is flagged for a manager, but the shift ends either way: a cashier
 * who cannot close because the count is $3 out either stays until someone with
 * authority arrives, or starts inventing a count that balances. Both are worse
 * than a recorded, explained discrepancy.
 *
 * `cashRemoved` is what is taken to the safe; what is left (`cashLeft` on the
 * answer) is tomorrow's float. The form adds nothing of its own to that
 * arithmetic beyond showing it as it is typed.
 */
export function CloseDrawerPanel({ session, canClose }: { session: ApiCashSession; canClose: boolean }) {
  const close = useCloseCashSession()
  const idempotency = useIdempotencyKey()
  const [counted, setCounted] = useState('')
  const [removed, setRemoved] = useState('')
  const [note, setNote] = useState('')
  const [confirming, setConfirming] = useState(false)

  const expected = priceOf(cashSessionTotals(session).expectedCash)
  const countedTyped = counted.trim()
  const countedValue = countedTyped === '' ? null : parseMoneyInput(countedTyped, MAX_CASH_TENDERED)
  const removedTyped = removed.trim()
  const removedValue = removedTyped === '' ? 0 : parseMoneyInput(removedTyped, MAX_CASH_TENDERED)

  const noteRequired = countedValue !== null && needsDifferenceNote(countedValue, session)
  const removedTooMuch = countedValue !== null && removedValue > countedValue
  const ready =
    countedValue !== null && !removedTooMuch && (!noteRequired || note.trim().length > 0)
  const left = countedValue === null ? null : Math.round((countedValue - removedValue) * 100) / 100

  const submit = () => {
    if (!ready || countedValue === null) return
    close.mutate(
      {
        id: session.id,
        countedCash: countedValue,
        ...(removedTyped === '' ? {} : { cashRemoved: removedValue }),
        differenceNote: note.trim() || undefined,
        idempotencyKey: idempotency.current(),
      },
      { onSuccess: idempotency.reset },
    )
  }

  if (!canClose) {
    return (
      <Panel title="Close the drawer" description="Ends the session and files the count.">
        <p className="panel-body muted">
          Closing the drawer needs the cash drawer closing permission. Leave the session open and ask a manager.
        </p>
      </Panel>
    )
  }

  return (
    <Panel
      title="Physical drawer currency count"
      description="Count the till in USD, say how much is going to the safe, and finalize the shift."
    >
      <form
        className="panel-body stack gap-md"
        style={{ maxWidth: '32rem' }}
        onSubmit={(event) => {
          event.preventDefault()
          if (!confirming) {
            setConfirming(true)
            return
          }
          submit()
        }}
      >
        <CashCountField
          label="Counted in the drawer"
          hint="Everything in the till, including the opening float."
          counted={counted}
          onCountedChange={(value) => {
            setCounted(value)
            setConfirming(false)
          }}
          expected={expected}
          note={note}
          onNoteChange={setNote}
          noteRequired={noteRequired}
          noteLabel="Why the count differs"
          disabled={close.isPending}
        />

        <Field
          label="Taken to the safe (optional)"
          hint="What is left stays in the till as tomorrow's float."
          error={removedTooMuch ? 'You cannot take out more than you counted.' : undefined}
        >
          <input
            type="text"
            inputMode="decimal"
            className="tabular"
            value={removed}
            placeholder="0"
            disabled={close.isPending}
            onChange={(event) => {
              setRemoved(event.target.value.replace(/[^\d.]/g, ''))
              setConfirming(false)
            }}
          />
        </Field>

        {left !== null && !removedTooMuch && (
          <p className="muted text-sm" style={{ margin: 0 }}>
            {formatPrice(left)} stays in the drawer as tomorrow's float.
          </p>
        )}

        {noteRequired && (
          <p className="muted text-sm" style={{ margin: 0 }}>
            A count that differs is flagged for a manager to review. It does not stop you closing.
          </p>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={close.isPending || !ready}>
            {close.isPending
              ? 'Closing…'
              : confirming
                ? `Yes, close with ${countedValue === null ? '' : formatPrice(countedValue)} counted`
                : 'Close the drawer'}
          </button>
          {confirming && !close.isPending && (
            <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)}>
              Keep it open
            </button>
          )}
        </div>
      </form>
    </Panel>
  )
}
