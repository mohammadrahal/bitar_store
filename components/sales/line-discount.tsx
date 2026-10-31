'use client'

import { useState } from 'react'
import { BadgePercent } from 'lucide-react'
import { Field } from '@/components/shared/field'
import { formatPrice } from '@/lib/format'

export interface LineDiscount {
  percent: number
  reason: string
}

/**
 * Money off one line. It goes to `POST /sales` with the sale and the server
 * records who applied it, so only `discounts.apply` offers the control. A
 * discount can never exceed the line, hence the cap at 100.
 */
export function LineDiscountField({
  lineTotal,
  mayApply,
  value,
  onChange,
}: {
  lineTotal: number
  mayApply: boolean
  value: LineDiscount | undefined
  onChange: (next: LineDiscount | undefined) => void
}) {
  const [draft, setDraft] = useState<LineDiscount>({ percent: 0, reason: '' })

  if (!mayApply) return null

  if (value) {
    const off = (lineTotal * value.percent) / 100
    return (
      <p className="muted">
        <BadgePercent size={14} aria-hidden="true" /> {value.percent}% off — {formatPrice(off)} · {value.reason}{' '}
        <button type="button" className="text-btn" onClick={() => onChange(undefined)}>
          Remove
        </button>
      </p>
    )
  }

  const percentFor = (text: string) => Math.min(100, Math.max(0, Number(text) || 0))
  const off = (lineTotal * draft.percent) / 100
  const ready = draft.percent > 0 && draft.reason.trim() !== ''

  return (
    <div className="inline-add">
      <Field label="Discount %">
        <input
          type="number"
          min="0"
          max="100"
          step="1"
          inputMode="numeric"
          className="tabular"
          value={draft.percent || ''}
          placeholder="0"
          onChange={(event) => setDraft({ ...draft, percent: percentFor(event.target.value) })}
        />
      </Field>
      <Field label="Reason" hint={draft.percent > 0 ? `${formatPrice(off)} off this line` : undefined}>
        <input
          value={draft.reason}
          onChange={(event) => setDraft({ ...draft, reason: event.target.value })}
          autoComplete="off"
          placeholder="Damaged seam"
        />
      </Field>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={!ready}
        onClick={() => {
          onChange({ percent: draft.percent, reason: draft.reason.trim() })
          setDraft({ percent: 0, reason: '' })
        }}
      >
        Apply
      </button>
    </div>
  )
}
