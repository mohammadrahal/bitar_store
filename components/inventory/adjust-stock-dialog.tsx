'use client'

import { useState } from 'react'
import { Drawer } from '@/components/shared/drawer'
import { Field } from '@/components/shared/field'
import { SelectInput } from '@/components/shared/select-input'
import { usePostStockCorrection } from '@/hooks/use-stock-receipts'
import { ADJUSTMENT_REASONS, type ApiAdjustmentReason } from '@/lib/api/types'
import { formatNumber, formatSigned } from '@/lib/format'
import { REASON_LABELS } from '@/services/stock-receipts.service'

const REASON_OPTIONS = ADJUSTMENT_REASONS.map((value) => ({ value, label: REASON_LABELS[value] }))

/**
 * Correcting one variant at one location.
 *
 * The box asks for the **counted total**, not the difference, because that is
 * what the person holding the stock actually knows; the difference is worked
 * out and shown before they commit. The endpoint takes a delta, which is the
 * safer thing to send: a total would overwrite whatever was sold while the box
 * was open, a delta applies on top of it.
 */
export function AdjustStockDialog({
  variantLabel,
  skuId,
  code,
  branchId,
  branchName,
  onHand,
  onClose,
}: {
  variantLabel: string
  skuId: string
  code: string
  branchId: string
  branchName: string
  onHand: number
  onClose: () => void
}) {
  const [counted, setCounted] = useState(String(onHand))
  const [reason, setReason] = useState<ApiAdjustmentReason>('count_correction')
  const [note, setNote] = useState('')
  const correct = usePostStockCorrection()

  const parsed = Number(counted)
  const valid = counted.trim() !== '' && Number.isInteger(parsed) && parsed >= 0
  const delta = valid ? parsed - onHand : 0
  const noteTooShort = note.trim().length > 0 && note.trim().length < 5

  const problem = !valid
    ? 'Enter the counted quantity as a whole number.'
    : delta === 0
      ? 'The counted quantity matches what is on hand, so there is nothing to correct.'
      : note.trim().length < 5
        ? 'Say what happened, in at least five characters.'
        : null

  const submit = () => {
    if (problem) return
    correct.mutate(
      { branchId, skuId, quantityDelta: delta, reason, note },
      { onSuccess: onClose },
    )
  }

  return (
    <Drawer
      eyebrow="Correct stock"
      title={variantLabel}
      description={`${code} at ${branchName}`}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={Boolean(problem) || correct.isPending}>
            {correct.isPending ? 'Posting…' : 'Post correction'}
          </button>
        </>
      }
    >
      <dl className="detail-grid-fields detail-grid-fields--2">
        <div>
          <dt>On hand now</dt>
          <dd className="tabular">{formatNumber(onHand)}</dd>
        </div>
        <div>
          <dt>Change</dt>
          <dd className="tabular">{valid && delta !== 0 ? formatSigned(delta) : '—'}</dd>
        </div>
      </dl>

      <Field
        label="Counted quantity"
        hint="What is physically there, counted now."
        error={!valid && counted.trim() !== '' ? 'Whole pieces, zero or more.' : undefined}
      >
        <input
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          className="input tabular"
          value={counted}
          onChange={(event) => setCounted(event.target.value)}
        />
      </Field>

      <Field label="Reason">
        <SelectInput
          value={reason}
          onValueChange={(value) => setReason(value as ApiAdjustmentReason)}
          options={REASON_OPTIONS}
        />
      </Field>

      <Field
        label="What happened"
        hint="Goes into the audit log under your name, so the next person can see why the figure moved."
        error={noteTooShort ? 'At least five characters.' : undefined}
      >
        <textarea
          className="input"
          rows={3}
          maxLength={200}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Counted the rail twice, two pieces missing"
        />
      </Field>
    </Drawer>
  )
}
