'use client'

import Link from 'next/link'
import { Field } from '@/components/shared/field'
import { PriceWithLbp } from '@/components/shared/price-with-lbp'
import { useExchangeRate } from '@/hooks/use-settings'
import { usePermission } from '@/hooks/use-permission'
import { formatLbp, formatPrice } from '@/lib/format'
import { MAX_CASH_TENDERED, MAX_LINE_MONEY, parseMoneyInput } from '@/lib/input-limits'
import { usdToLbp } from '@/services/settings.service'
import { adminHubHref } from '@/lib/admin-hub'
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
 * reference it has seen before. that error lands under the field.
 */
export function PaymentFields({
  draft,
  total,
  onChange,
  referenceError,
  totalLabel = 'Sale total',
  showRateHint = true,
}: {
  draft: PaymentDraft
  total: number
  onChange: (next: PaymentDraft) => void
  /** The server's message when it rejects the Whish reference. */
  referenceError?: string
  totalLabel?: string
  /** Till footer already shows the exchange line. */
  showRateHint?: boolean
}) {
  const { cash, whish } = amountsOf(draft, total)
  const change = changeDue(draft, total)
  const rateQuery = useExchangeRate()
  const { can } = usePermission()
  const canSetRate = can('settings.manage')
  const changeLbp = usdToLbp(change, rateQuery.rate)
  const set = (patch: Partial<PaymentDraft>) => onChange({ ...draft, ...patch })

  return (
    <section className="sale-card till-panel" aria-label="Payment">
      {showRateHint &&
        (rateQuery.rate !== null ? (
          <p className="till-rate-hint muted">
            1 USD = {formatLbp(rateQuery.rate)} · totals show an LBP guide for the customer
          </p>
        ) : canSetRate ? (
          <p className="till-rate-hint muted">
            No LBP rate yet.{' '}
            <Link href={adminHubHref('settings')} className="text-link">
              Set USD / LBP in Settings
            </Link>
          </p>
        ) : null)}
      <div className="segmented compact till-segmented" role="radiogroup" aria-label="Payment method">
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

      <div className="till-total-row">
        <span className="muted">{totalLabel}</span>
        <PriceWithLbp usd={total} strong />
      </div>

      <div className="form-grid">
        {draft.mode === 'split' && (
          <>
            <Field label="Cash amount">
              <input
                type="number"
                min="0"
                max={MAX_LINE_MONEY}
                step="0.01"
                inputMode="decimal"
                className="tabular till-input"
                value={draft.cashAmount || ''}
                onChange={(event) => {
                  const next = parseMoneyInput(event.target.value, MAX_LINE_MONEY)
                  set({
                    cashAmount: next,
                    whishAmount: parseMoneyInput(String(Math.max(0, total - next)), MAX_LINE_MONEY),
                  })
                }}
              />
            </Field>
            <Field label="Whish amount" hint="The two parts must add up to the total">
              <input
                type="number"
                min="0"
                max={MAX_LINE_MONEY}
                step="0.01"
                inputMode="decimal"
                className="tabular till-input"
                value={draft.whishAmount || ''}
                onChange={(event) => set({ whishAmount: parseMoneyInput(event.target.value, MAX_LINE_MONEY) })}
              />
            </Field>
          </>
        )}

        {cash > 0 && (
          <>
            <Field label="Cash received" hint="Edit if the customer paid with a larger bill.">
              <input
                type="number"
                min="0"
                max={MAX_CASH_TENDERED}
                step="0.01"
                inputMode="decimal"
                className="tabular till-input"
                value={draft.tendered > 0 ? draft.tendered : cash || ''}
                onChange={(event) => set({ tendered: parseMoneyInput(event.target.value, MAX_CASH_TENDERED) })}
              />
            </Field>
            <Field
              label="Change to give"
              hint={change > 0 ? 'Hand this back to the customer with the receipt.' : 'Exact payment. Nothing to return.'}
            >
              <p className="till-change-readout tabular" aria-live="polite">
                {formatPrice(change)}
                {changeLbp != null && change > 0 && (
                  <small className="price-lbp"> ≈ {formatLbp(changeLbp)}</small>
                )}
              </p>
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
              className="till-input"
              value={draft.whishReference}
              onChange={(event) => set({ whishReference: event.target.value.slice(0, 64) })}
              autoComplete="off"
              placeholder="WH-12345"
              spellCheck={false}
              maxLength={64}
            />
          </Field>
        )}
      </div>
    </section>
  )
}
