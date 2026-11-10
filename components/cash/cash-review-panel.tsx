'use client'

import { useState } from 'react'
import { Field } from '@/components/shared/field'
import { Panel } from '@/components/shared/panel'
import { useCorrectCashSession, useReviewCashSession } from '@/hooks/use-cash-sessions'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { formatRelativeDateTime } from '@/lib/format'
import { MAX_CASH_TENDERED, parseMoneyInput } from '@/lib/input-limits'
import type { ApiCashSession, CashCorrectionInput } from '@/lib/api/types'

const FIELDS: { value: CashCorrectionInput['field']; label: string }[] = [
  { value: 'countedCash', label: 'Counted at closing' },
  { value: 'openingCash', label: 'Opening float' },
  { value: 'cashRemoved', label: 'Taken to the safe' },
]

/**
 * A manager signing a closed session off, and correcting it if a figure was
 * entered wrong.
 *
 * Both actions are here together because they are one judgement: the manager
 * looks at a flagged count, decides whether a figure was mistyped, fixes it if
 * so, and signs. Splitting them would mean reviewing on one screen and
 * correcting on another with the numbers out of sight.
 *
 * A correction needs a reason and never replaces the original count — the
 * comparison above keeps both.
 */
export function CashReviewPanel({ session }: { session: ApiCashSession }) {
  const correct = useCorrectCashSession()
  const review = useReviewCashSession()
  const idempotency = useIdempotencyKey()
  const [field, setField] = useState<CashCorrectionInput['field']>('countedCash')
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')

  const typed = value.trim()
  const parsed = typed === '' ? null : parseMoneyInput(typed, MAX_CASH_TENDERED)
  const canCorrect = parsed !== null && reason.trim().length > 0

  const reviewed = session.review.reviewedAt !== null

  return (
    <Panel
      title="Manager review"
      description={
        reviewed
          ? `Signed off by ${session.review.reviewedBy?.name ?? 'a manager'} ${formatRelativeDateTime(session.review.reviewedAt as string)}.`
          : session.review.flagged
            ? 'This session is flagged: the count did not match what was expected.'
            : 'This session balanced. You can still record a correction if a figure was entered wrong.'
      }
    >
      {reviewed && session.review.note ? (
        <p className="panel-body muted" style={{ margin: 0 }}>
          <strong>Review note:</strong> {session.review.note}
        </p>
      ) : null}

      <form
        className="panel-body stack gap-md"
        onSubmit={(event) => {
          event.preventDefault()
          if (!canCorrect || parsed === null) return
          correct.mutate(
            { id: session.id, field, value: parsed, reason, idempotencyKey: idempotency.current() },
            {
              onSuccess: () => {
                idempotency.reset()
                setValue('')
                setReason('')
              },
            },
          )
        }}
      >
        <div className="form-grid">
          <Field label="Correct a figure">
            <select value={field} onChange={(event) => setField(event.target.value as CashCorrectionInput['field'])}>
              {FIELDS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Should have been">
            <input
              type="text"
              inputMode="decimal"
              className="tabular"
              value={value}
              placeholder="0"
              onChange={(event) => setValue(event.target.value.replace(/[^\d.]/g, ''))}
            />
          </Field>
          <Field label="Reason" hint="Required. It is recorded beside the original figure.">
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Counted $500 as $5.00 in the closing"
              autoComplete="off"
            />
          </Field>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-secondary" disabled={correct.isPending || !canCorrect}>
            {correct.isPending ? 'Recording…' : 'Record the correction'}
          </button>
        </div>
      </form>

      {!reviewed && (
        <form
          className="panel-body stack gap-md"
          onSubmit={(event) => {
            event.preventDefault()
            review.mutate(
              { id: session.id, note: note.trim() || undefined },
              { onSuccess: () => setNote('') },
            )
          }}
        >
          <Field label="Review note (optional)" hint="What you concluded, for whoever reads this later.">
            <textarea
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Short because the courier was paid from the till. Accepted."
            />
          </Field>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={review.isPending}>
              {review.isPending ? 'Signing off…' : 'Sign this shift off'}
            </button>
          </div>
        </form>
      )}
    </Panel>
  )
}
