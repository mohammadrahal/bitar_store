'use client'

import { useState } from 'react'
import { BadgePercent } from 'lucide-react'
import { Field } from '@/components/shared/field'
import { formatPrice } from '@/lib/format'
import type { DiscountRequest } from '@/types'

export interface LineDiscount {
  percent: number
  reason: string
}

/**
 * Money off one line. An owner role types it in and it goes with the sale; an
 * employee with `discounts.request` can only ask, and the till will not
 * complete until a super admin or manager has approved it (BL-04). A discount
 * can never exceed the line, so the percentage is capped at 100.
 */
export function LineDiscountField({
  lineTotal,
  variantId,
  mayApply,
  mayRequest,
  value,
  request,
  onChange,
  onRequest,
  pending,
}: {
  lineTotal: number
  variantId: string
  mayApply: boolean
  mayRequest: boolean
  value: LineDiscount | undefined
  /** The ask already on file for this variant, if any. */
  request: DiscountRequest | undefined
  onChange: (next: LineDiscount | undefined) => void
  onRequest: (variantId: string, discount: LineDiscount) => void
  pending: boolean
}) {
  const [draft, setDraft] = useState<LineDiscount>({ percent: request?.percent ?? 0, reason: request?.reason ?? '' })

  if (request) {
    const off = (lineTotal * request.percent) / 100
    return (
      <p className={request.status === 'approved' ? 'muted' : 'field-hint'}>
        <BadgePercent size={14} aria-hidden="true" />{' '}
        {request.status === 'approved'
          ? `${request.percent}% approved by ${request.decidedBy ?? 'a manager'} — ${formatPrice(off)} off`
          : `${request.percent}% requested — waiting for a manager to approve before this sale can be completed`}
      </p>
    )
  }

  if (!mayApply && !mayRequest) return <p className="muted">Discounts are applied by a manager.</p>

  const percentFor = (text: string) => Math.min(100, Math.max(0, Number(text) || 0))
  const off = (lineTotal * draft.percent) / 100
  const ready = draft.percent > 0 && draft.reason.trim() !== ''

  return (
    <div className="form-grid">
      <Field label="Discount %" hint={draft.percent > 0 ? `${formatPrice(off)} off this line` : 'Optional'}>
        <input
          type="number"
          min="0"
          max="100"
          step="0.01"
          inputMode="decimal"
          className="tabular"
          value={draft.percent || ''}
          onChange={(event) => {
            const percent = percentFor(event.target.value)
            setDraft((current) => ({ ...current, percent }))
            if (mayApply) onChange(percent > 0 ? { percent, reason: draft.reason } : undefined)
          }}
        />
      </Field>
      <Field label="Reason" hint={mayApply ? 'Recorded with the sale' : 'Shown to whoever approves'}>
        <input
          value={draft.reason}
          onChange={(event) => {
            const reason = event.target.value
            setDraft((current) => ({ ...current, reason }))
            if (mayApply && draft.percent > 0) onChange({ percent: draft.percent, reason })
          }}
          autoComplete="off"
          placeholder="Damaged packaging"
        />
      </Field>
      {!mayApply && (
        <div className="full">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!ready || pending}
            onClick={() => onRequest(variantId, draft)}
          >
            {pending ? 'Sending…' : 'Request approval'}
          </button>
        </div>
      )}
      {value && value.reason.trim() === '' && (
        <p className="field-error full">A discount needs a reason before the sale can be completed.</p>
      )}
    </div>
  )
}
