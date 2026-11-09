'use client'

import { Field } from '@/components/shared/field'
import { formatPrice } from '@/lib/format'
import { MAX_CASH_TENDERED, parseMoneyInput } from '@/lib/input-limits'

/**
 * Counting the drawer, for a handover or a closing.
 *
 * Both calls behave the same way: the person counts, and a count that does not
 * match the expected cash **requires a note**. The server enforces that (a
 * handover without one is a 400), so the field for it appears the moment the
 * figures diverge rather than sitting there asking to be filled in on a count
 * that balanced.
 *
 * The difference is shown as it is typed, with its sign, because "short by
 * $12.50" is the thing the person has to act on and working it out from two
 * figures is how a count gets signed off wrong.
 */
export function CashCountField({
  label,
  hint,
  counted,
  onCountedChange,
  expected,
  note,
  onNoteChange,
  noteRequired,
  noteLabel = 'Why the count differs',
  disabled,
}: {
  label: string
  hint?: string
  /** Raw text, so a half-typed "12." is not rewritten under the cursor. */
  counted: string
  onCountedChange: (value: string) => void
  expected: number
  note: string
  onNoteChange: (value: string) => void
  /** True once the count differs: the note is then the server's requirement. */
  noteRequired: boolean
  noteLabel?: string
  disabled?: boolean
}) {
  const typed = counted.trim()
  const value = typed === '' ? null : parseMoneyInput(typed, MAX_CASH_TENDERED)
  const difference = value === null ? null : Math.round((value - expected) * 100) / 100

  return (
    <div className="stack gap-sm">
      <Field label={label} hint={hint}>
        <input
          type="text"
          inputMode="decimal"
          className="tabular"
          value={counted}
          disabled={disabled}
          placeholder={formatPrice(expected)}
          onChange={(event) => onCountedChange(event.target.value.replace(/[^\d.]/g, ''))}
        />
      </Field>

      <dl className="cash-count-readout">
        <div>
          <dt>Expected in the drawer</dt>
          <dd className="tabular">{formatPrice(expected)}</dd>
        </div>
        <div>
          <dt>Counted</dt>
          <dd className="tabular">{value === null ? '—' : formatPrice(value)}</dd>
        </div>
        <div>
          <dt>Difference</dt>
          <dd className={`tabular ${difference !== null && difference !== 0 ? 'detail-alert' : ''}`}>
            {difference === null
              ? '—'
              : difference === 0
                ? 'Balanced'
                : `${difference > 0 ? '+' : '-'}${formatPrice(Math.abs(difference))} (${difference < 0 ? 'short' : 'over'})`}
          </dd>
        </div>
      </dl>

      {noteRequired && (
        <Field
          label={noteLabel}
          hint="Required, because the count does not match. It goes in the record under your name."
        >
          <textarea
            rows={2}
            value={note}
            disabled={disabled}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder="Paid the delivery driver from the till and forgot to record it"
          />
        </Field>
      )}
    </div>
  )
}
