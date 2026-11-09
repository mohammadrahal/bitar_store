'use client'

import { useEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Drawer } from '@/components/shared/drawer'
import { Field } from '@/components/shared/field'
import { FilterChips, type ChipOption } from '@/components/shared/filter-chips'
import { SelectInput } from '@/components/shared/select-input'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { usePostStockCorrection } from '@/hooks/use-stock-receipts'
import { ADJUSTMENT_REASONS, type ApiAdjustmentReason } from '@/lib/api/types'
import { formatNumber, formatSigned } from '@/lib/format'
import { REASON_LABELS, reasonDirectionProblem } from '@/services/stock-receipts.service'
import type { LocationBalance } from '@/types'

const REASON_CHIPS: ChipOption<ApiAdjustmentReason>[] = ADJUSTMENT_REASONS.map((value) => ({
  value,
  label: REASON_LABELS[value],
}))

/** What a hand count usually differs by, so the common case needs no keyboard. */
const STEPS = [-5, -1, 1, 5]

/**
 * Correcting one variant at one location.
 *
 * The box asks for the **counted total**, not the difference, because that is
 * what the person holding the stock actually knows; the difference is worked
 * out and shown before they commit. The endpoint takes a delta, which is the
 * safer thing to send: a total would overwrite whatever was sold while the box
 * was open, a delta applies on top of it.
 *
 * It takes every location the viewer may correct rather than one, so the
 * location is a field inside the drawer instead of a reason to close it and
 * open another. Opened from a row in the list there is no location in hand at
 * all, and opened from a location row that row is simply the default.
 *
 * A reason and a sentence are required by the service, not by this form, which
 * is why there is no quieter inline version of this edit: every balance change
 * has to arrive at the audit log with a person and a cause attached.
 */
export function AdjustStockDialog({
  variantLabel,
  skuId,
  code,
  locations,
  initialBranchId,
  onClose,
}: {
  variantLabel: string
  skuId: string
  code: string
  /** Locations the viewer may correct at. One means no picker is shown. */
  locations: LocationBalance[]
  initialBranchId?: string
  onClose: () => void
}) {
  const [branchId, setBranchId] = useState(
    () => initialBranchId ?? locations[0]?.branchId ?? '',
  )
  const location = locations.find((candidate) => candidate.branchId === branchId) ?? locations[0]
  const onHand = location?.onHand ?? 0

  const [counted, setCounted] = useState(String(onHand))
  const [reason, setReason] = useState<ApiAdjustmentReason>('count_correction')
  const [note, setNote] = useState('')
  const correct = usePostStockCorrection()
  const idempotency = useIdempotencyKey()

  /* Switching location switches the figure being corrected, so the box starts
     again from what that location reports rather than carrying the last one.
     Keyed on the location alone: a background refresh of `onHand` must not
     overwrite a number someone is halfway through typing. */
  const countedFor = useRef(branchId)
  useEffect(() => {
    if (countedFor.current === branchId) return
    countedFor.current = branchId
    setCounted(String(onHand))
  }, [branchId, onHand])

  const parsed = Number(counted)
  const valid = counted.trim() !== '' && Number.isInteger(parsed) && parsed >= 0
  const delta = valid ? parsed - onHand : 0
  const noteTooShort = note.trim().length > 0 && note.trim().length < 5

  /* BL-02 rule 18: a negative correction only deducts **available** units. The
     endpoint takes the `sellable` bucket, so the pieces already on hold cannot
     be removed by a count — they are physically there and have their own
     release action. Counting below that floor would send a delta larger than
     the sellable balance and earn a `409`. */
  const onHoldFloor = location?.nonSellable ?? 0
  const belowHoldFloor = valid && parsed < onHoldFloor
  const directionProblem = valid && delta !== 0 ? reasonDirectionProblem(reason, delta) : null

  const problem = !location
    ? 'You cannot correct a balance at any of this variant’s locations.'
    : !valid
      ? 'Enter the counted quantity as a whole number.'
      : delta === 0
        ? 'The counted quantity matches what is on hand, so there is nothing to correct.'
        : belowHoldFloor
          ? `${formatNumber(onHoldFloor)} ${onHoldFloor === 1 ? 'piece is' : 'pieces are'} on hold here and cannot be counted away. Release them first, or count ${formatNumber(onHoldFloor)} or more.`
          : directionProblem
            ? directionProblem
            : note.trim().length < 5
              ? 'Say what happened, in at least five characters.'
              : null

  const step = (by: number) => setCounted(String(Math.max(0, (valid ? parsed : onHand) + by)))

  const submit = () => {
    if (problem || !location) return
    /* One key for this correction, held across retries: a fresh key on a second
       tap after a lost answer applied the same delta twice. */
    correct.mutate(
      {
        input: { branchId: location.branchId, skuId, quantityDelta: delta, reason, note },
        idempotencyKey: idempotency.current(),
      },
      {
        onSuccess: () => {
          idempotency.reset()
          onClose()
        },
      },
    )
  }

  return (
    <Drawer
      eyebrow="Correct stock"
      title={variantLabel}
      description={location ? `${code} at ${location.branchName}` : code}
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
      {locations.length > 1 && (
        <Field label="Location" hint="Balances are held per location; this corrects one of them.">
          <SelectInput
            value={branchId}
            onValueChange={setBranchId}
            options={locations.map((candidate) => ({
              value: candidate.branchId,
              label: `${candidate.branchName} · ${formatNumber(candidate.onHand)} on hand`,
            }))}
          />
        </Field>
      )}

      <dl className="detail-grid-fields detail-grid-fields--2">
        <div>
          <dt>On hand now</dt>
          <dd className="tabular">{formatNumber(onHand)}</dd>
        </div>
        <div>
          <dt>Change</dt>
          <dd className="tabular">{valid && delta !== 0 ? formatSigned(delta) : ''}</dd>
        </div>
        {onHoldFloor > 0 && (
          <div>
            <dt>On hold here</dt>
            <dd className="tabular">{formatNumber(onHoldFloor)}</dd>
          </div>
        )}
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

      <div className="count-steps" role="group" aria-label="Adjust the counted quantity">
        {STEPS.map((by) => (
          <button
            key={by}
            type="button"
            className="btn btn-secondary btn-sm tabular"
            onClick={() => step(by)}
            disabled={!valid && counted.trim() !== ''}
          >
            {by < 0 ? <Minus size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
            {Math.abs(by)}
          </button>
        ))}
      </div>

      <fieldset className="field">
        <legend>Reason</legend>
        <FilterChips label="Reason for the correction" options={REASON_CHIPS} value={reason} onChange={setReason} />
        {/* Said here rather than after the post: the server accepts "Found"
            only on an increase, and "Lost or stolen" / "Damaged" only on a
            decrease. */}
        {directionProblem && <p className="field-error">{directionProblem}</p>}
      </fieldset>

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
