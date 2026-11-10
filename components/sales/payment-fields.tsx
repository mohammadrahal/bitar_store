'use client'

import Link from 'next/link'
import { Field } from '@/components/shared/field'
import { PriceWithLbp } from '@/components/shared/price-with-lbp'
import { useExchangeRate } from '@/hooks/use-settings'
import { usePermission } from '@/hooks/use-permission'
import { formatLbp, formatNumber, formatPrice } from '@/lib/format'
import { fromCents, toCents } from '@/lib/money'
import { MAX_CASH_TENDERED, MAX_LINE_MONEY, MAX_LBP_CASH, parseLbpInput, parseMoneyInput } from '@/lib/input-limits'
import { lbpToUsd, usdToLbp } from '@/services/settings.service'
import { changeLbpUsd } from '@/lib/sale-payments'
import { adminHubHref } from '@/lib/admin-hub'
import {
  amountsOf,
  changeDue,
  syncTendered,
  tenderedUsdEquivalent,
  type PaymentDraft,
  type PaymentMode,
} from '@/lib/sale-payments'

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
  embedded = false,
}: {
  draft: PaymentDraft
  total: number
  onChange: (next: PaymentDraft) => void
  /** The server's message when it rejects the Whish reference. */
  referenceError?: string
  totalLabel?: string
  /** Till footer already shows the exchange line. */
  showRateHint?: boolean
  /** Sit inside the till ticket instead of a second card. */
  embedded?: boolean
}) {
  const { cash, whish } = amountsOf(draft, total)
  const rateQuery = useExchangeRate()
  const { can } = usePermission()
  const canSetRate = can('settings.manage')
  const rate = rateQuery.rate
  const change = changeDue(draft, total, rate)
  const tenderedEquiv = tenderedUsdEquivalent(draft, rate)
  const changeLbpGuide = usdToLbp(change, rate)
  const changeUsdFromLbp = draft.changeLbp > 0 ? changeLbpUsd(draft.changeLbp, rate) : null
  const changeUsdRemaining =
    changeUsdFromLbp != null ? Math.max(0, fromCents(toCents(change) - toCents(changeUsdFromLbp))) : change
  const set = (patch: Partial<PaymentDraft>) => onChange({ ...draft, ...patch })

  return (
    <section className={embedded ? 'till-panel sale-ticket-pay' : 'sale-card till-panel'} aria-label="Payment">
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
                    payInLbp: false,
                    changeLbp: 0,
                    tenderSource: 'usd',
                    tenderedLbp: 0,
                  },
                  total,
                  rate,
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
            {draft.payInLbp && draft.mode === 'cash' ? (
              <Field
                label="Paid in pounds"
                hint={`Exact sale total at 1 USD = ${rate != null ? formatLbp(rate) : '—'}. No USD tendered or change.`}
                className="full"
              >
                <p className="till-change-readout tabular">
                  {rate != null ? formatLbp(usdToLbp(cash, rate) ?? 0) : '—'}
                  <small className="price-lbp block">= {formatPrice(cash)}</small>
                </p>
                <label className="checkbox-row" style={{ marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={draft.payInLbp}
                    onChange={(event) =>
                      set(
                        event.target.checked
                          ? {
                              payInLbp: true,
                              tendered: cash,
                              tenderedLbp: usdToLbp(cash, rate) ?? 0,
                              changeLbp: 0,
                              tenderSource: 'lbp',
                            }
                          : { payInLbp: false, tendered: cash, tenderedLbp: 0, tenderSource: 'usd' },
                      )
                    }
                  />
                  Customer paid exact amount in LBP notes
                </label>
              </Field>
            ) : (
              <>
                <Field label="Count payment in">
                  <div className="segmented compact till-segmented" role="radiogroup" aria-label="Cash counting currency">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={draft.tenderSource === 'usd'}
                      className={draft.tenderSource === 'usd' ? 'active' : ''}
                      onClick={() =>
                        set({
                          tenderSource: 'usd',
                          payInLbp: false,
                          tenderedLbp: 0,
                          tendered: draft.tendered > 0 ? draft.tendered : cash,
                        })
                      }
                    >
                      USD notes
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={draft.tenderSource === 'lbp'}
                      className={draft.tenderSource === 'lbp' ? 'active' : ''}
                      disabled={rate == null}
                      onClick={() =>
                        set({
                          tenderSource: 'lbp',
                          payInLbp: false,
                          changeLbp: 0,
                          tenderedLbp: usdToLbp(cash, rate) ?? 0,
                        })
                      }
                    >
                      LBP notes
                    </button>
                  </div>
                </Field>
                {draft.tenderSource === 'usd' ? (
                  <Field label="Cash received (USD)" hint="Edit if the customer paid with a larger bill.">
                    <input
                      type="number"
                      min="0"
                      max={MAX_CASH_TENDERED}
                      step="0.01"
                      inputMode="decimal"
                      className="tabular till-input"
                      value={draft.tendered > 0 ? draft.tendered : cash || ''}
                      onChange={(event) =>
                        set({
                          payInLbp: false,
                          tendered: parseMoneyInput(event.target.value, MAX_CASH_TENDERED),
                        })
                      }
                    />
                    {rate != null ? (
                      <p className="muted text-sm" style={{ margin: '6px 0 0' }}>
                        ≈ {formatLbp(usdToLbp(draft.tendered > 0 ? draft.tendered : cash, rate) ?? 0)} guide
                      </p>
                    ) : null}
                  </Field>
                ) : (
                  <Field
                    label="Cash received (LBP)"
                    hint="Whole pounds the customer handed you — change is calculated in USD equivalent."
                  >
                    <input
                      type="text"
                      inputMode="numeric"
                      className="tabular till-input"
                      disabled={rate == null}
                      value={draft.tenderedLbp > 0 ? formatNumber(draft.tenderedLbp) : ''}
                      placeholder={rate != null ? formatNumber(usdToLbp(cash, rate) ?? 0) : undefined}
                      onChange={(event) =>
                        set({
                          payInLbp: false,
                          tenderedLbp: parseLbpInput(event.target.value, MAX_LBP_CASH),
                        })
                      }
                    />
                    {rate != null && draft.tenderedLbp > 0 ? (
                      <p className="muted text-sm" style={{ margin: '6px 0 0' }}>
                        ≈ {formatPrice(tenderedEquiv)} USD counted for change
                      </p>
                    ) : null}
                  </Field>
                )}
                {draft.mode === 'cash' && rate != null && change <= 0 && draft.tenderSource === 'lbp' ? (
                  <Field label="Exact LBP payment" className="full">
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={draft.payInLbp}
                        onChange={(event) =>
                          set(
                            event.target.checked
                              ? {
                                  payInLbp: true,
                                  tendered: cash,
                                  tenderedLbp: usdToLbp(cash, rate) ?? 0,
                                  changeLbp: 0,
                                }
                              : { payInLbp: false },
                          )
                        }
                      />
                      Customer paid the exact sale total in LBP (no change)
                    </label>
                  </Field>
                ) : null}
                <Field
                  label="Change to give (USD)"
                  hint={change > 0 ? 'Hand this back to the customer with the receipt.' : 'Exact payment. Nothing to return.'}
                >
                  <p className="till-change-readout tabular" aria-live="polite">
                    {formatPrice(changeUsdRemaining)}
                    {changeUsdFromLbp != null && changeUsdFromLbp > 0 ? (
                      <small className="muted block">Includes {formatPrice(changeUsdFromLbp)} as LBP notes below</small>
                    ) : null}
                    {changeLbpGuide != null && change > 0 ? (
                      <small className="price-lbp"> ≈ {formatLbp(changeLbpGuide)}</small>
                    ) : null}
                  </p>
                </Field>
                <Field
                  label="Change in pounds (LBP)"
                  hint={
                    change > 0 && rate != null
                      ? 'Optional — whole pounds to return instead of part of the USD change.'
                      : 'Only when there is change and a rate is set.'
                  }
                >
                  <input
                    type="text"
                    inputMode="numeric"
                    className="tabular till-input"
                    disabled={change <= 0 || rate == null}
                    value={draft.changeLbp > 0 ? formatNumber(draft.changeLbp) : ''}
                    placeholder="0"
                    onChange={(event) => set({ changeLbp: parseLbpInput(event.target.value, MAX_LBP_CASH), payInLbp: false })}
                  />
                  {draft.changeLbp > 0 && changeUsdFromLbp != null ? (
                    <p className="muted text-sm" style={{ margin: '6px 0 0' }}>
                      ≈ {formatPrice(changeUsdFromLbp)} of the change in pounds
                    </p>
                  ) : null}
                </Field>
              </>
            )}
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
