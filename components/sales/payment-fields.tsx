'use client'

import { Field } from '@/components/shared/field'
import { formatPrice } from '@/lib/format'
import { amountsOf, changeDue, syncTendered, type PaymentDraft, type PaymentMode } from '@/lib/sale-payments'

const MODES: { value: PaymentMode; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'whish', label: 'Whish' },
  { value: 'split', label: 'Both' },
]

/**
 * How the sale is paid: cash, Whish, or both with an amount each (BL-04). Cash
 * records what was tendered and shows the change, which is money handed back
 * rather than revenue. Whish needs its reference, and the server refuses a
 * reference it has seen before — that error lands under the field.
 */
export function PaymentFields({
  draft,
  total,
  onChange,
  referenceError,
}: {
  draft: PaymentDraft
  total: number
  onChange: (next: PaymentDraft) => void
  /** The server's message when it rejects the Whish reference. */
  referenceError?: string
}) {
  const { cash, whish } = amountsOf(draft, total)
  const change = changeDue(draft, total)
  const set = (patch: Partial<PaymentDraft>) => onChange({ ...draft, ...patch })

  const amount = (value: string) => Math.max(0, Number(value) || 0)

  return (
    <section className="sale-card" aria-label="Payment">
      <div className="segmented compact" role="radiogroup" aria-label="Payment method">
        {MODES.map((mode) => (
          <button
            key={mode.value}
            type="button"
            role="radio"
            aria-checked={draft.mode === mode.value}
            className={draft.mode === mode.value ? 'active' : ''}
            onClick={() =>
              onChange(
                syncTendered(
                  {
                    ...draft,
                    mode: mode.value,
                    /* Splitting starts from the whole total in cash, so the cashier
                       moves part of it to Whish rather than typing both. */
                    cashAmount: mode.value === 'split' ? total : 0,
                    whishAmount: 0,
                  },
                  total,
                ),
              )
            }
          >
            {mode.label}
          </button>
        ))}
      </div>

      <div className="form-grid">
        {draft.mode === 'split' && (
          <>
            <Field label="Cash amount">
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                className="tabular"
                value={draft.cashAmount || ''}
                onChange={(event) => {
                  const next = amount(event.target.value)
                  set({ cashAmount: next, whishAmount: Math.max(0, Math.round((total - next) * 100) / 100) })
                }}
              />
            </Field>
            <Field label="Whish amount" hint="The two parts must add up to the total">
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                className="tabular"
                value={draft.whishAmount || ''}
                onChange={(event) => set({ whishAmount: amount(event.target.value) })}
              />
            </Field>
          </>
        )}

        {cash > 0 && (
          <>
            <Field
              label="Cash received"
              hint="Filled with the sale total. Edit if they paid with a larger bill."
            >
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                className="tabular"
                value={draft.tendered > 0 ? draft.tendered : cash || ''}
                onChange={(event) => set({ tendered: amount(event.target.value) })}
              />
            </Field>
            <Field
              label="Change"
              hint={change > 0 ? 'Give this back to the customer' : 'Exact payment — nothing to hand back'}
            >
              <input type="text" className="tabular" value={formatPrice(change)} readOnly tabIndex={-1} />
            </Field>
          </>
        )}

        {whish > 0 && (
          <Field
            label="Whish reference"
            error={referenceError}
            hint={referenceError ? undefined : `Whish due ${formatPrice(whish)}`}
            className="full"
          >
            <input
              value={draft.whishReference}
              onChange={(event) => set({ whishReference: event.target.value })}
              autoComplete="off"
              placeholder="WH-12345"
              spellCheck={false}
            />
          </Field>
        )}
      </div>
    </section>
  )
}
