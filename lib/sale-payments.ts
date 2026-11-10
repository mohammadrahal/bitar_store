import { formatPrice } from '@/lib/format'
import { MAX_CASH_TENDERED, MAX_LINE_MONEY, MAX_LBP_CASH } from '@/lib/input-limits'
import { fromCents, toCents } from '@/lib/money'
import { lbpToUsd, usdToLbp } from '@/services/settings.service'

export type PaymentMode = 'cash' | 'whish' | 'split'

/** What the payment block holds while the cashier fills it in. */
export interface PaymentDraft {
  mode: PaymentMode
  /** Taken in cash. Equals the total unless the sale is split. */
  cashAmount: number
  /** USD notes the customer handed over (when counting in USD). */
  tendered: number
  /** Whole LBP notes received (when counting in pounds). */
  tenderedLbp: number
  /** Which field drives cash received for change / POST /sales tendered. */
  tenderSource: 'usd' | 'lbp'
  /** Whole pounds to return as part of the change (optional). */
  changeLbp: number
  /** Exact cash portion paid in pounds — `POST /sales` sends `currency: LBP`. */
  payInLbp: boolean
  /** Taken through Whish. */
  whishAmount: number
  whishReference: string
}

export function emptyPayment(): PaymentDraft {
  return {
    mode: 'cash',
    cashAmount: 0,
    tendered: 0,
    tenderedLbp: 0,
    tenderSource: 'usd',
    changeLbp: 0,
    payInLbp: false,
    whishAmount: 0,
    whishReference: '',
  }
}

export function changeLbpUsd(changeLbp: number, rate: number | null): number | null {
  return lbpToUsd(changeLbp, rate)
}

/** The amount each method covers, with the single-method cases filled in for you. */
export function amountsOf(draft: PaymentDraft, total: number): { cash: number; whish: number } {
  if (draft.mode === 'cash') return { cash: total, whish: 0 }
  if (draft.mode === 'whish') return { cash: 0, whish: total }
  return { cash: draft.cashAmount, whish: draft.whishAmount }
}

/** USD equivalent of cash handed over, from whichever side the cashier counted. */
export function tenderedUsdEquivalent(draft: PaymentDraft, rate: number | null): number {
  if (draft.payInLbp) return draft.tendered
  if (draft.tenderSource === 'lbp' && draft.tenderedLbp > 0 && rate) {
    return lbpToUsd(draft.tenderedLbp, rate) ?? draft.tendered
  }
  return draft.tendered
}

export function changeDue(draft: PaymentDraft, total: number, rate: number | null = null): number {
  const { cash } = amountsOf(draft, total)
  const tendered = tenderedUsdEquivalent(draft, rate)
  return Math.max(0, fromCents(toCents(tendered) - toCents(cash)))
}

/**
 * Why the sale cannot be completed yet, or null when the payment is good. A
 * completed sale has to be paid in full, so the parts must add up to the total
 * exactly; cents are compared as integers so a split never fails on a float.
 */
export function paymentProblem(draft: PaymentDraft, total: number, rate: number | null = null): string | null {
  const { cash, whish } = amountsOf(draft, total)
  const totalCents = toCents(total)

  if (totalCents <= 0) return 'Add an item before taking payment.'
  if (total > MAX_LINE_MONEY) return `Sale total cannot exceed ${formatPrice(MAX_LINE_MONEY)}.`
  if (cash < 0 || whish < 0) return 'A payment cannot be negative.'
  if (cash > MAX_LINE_MONEY || whish > MAX_LINE_MONEY) return 'A single payment part is too large.'
  if (draft.tendered > MAX_CASH_TENDERED) return 'Cash received is above the allowed maximum.'
  if (draft.tenderedLbp > MAX_LBP_CASH) return 'Cash received in pounds is above the allowed maximum.'
  if (toCents(cash) + toCents(whish) !== totalCents) {
    return `The payments must add up to ${formatPrice(fromCents(totalCents))}.`
  }
  if (whish > 0 && draft.whishReference.trim() === '') return 'Enter the Whish reference.'
  if (cash > 0 && draft.payInLbp) {
    if (draft.mode !== 'cash' || whish > 0) return 'Paying in pounds only works for a full cash sale.'
    if (draft.changeLbp > 0 || tenderedUsdEquivalent(draft, rate) > cash) {
      return 'A pounds payment has no change or extra tendered.'
    }
    if (!rate) return 'Set USD / LBP in Settings before taking payment in pounds.'
  } else if (cash > 0 && toCents(tenderedUsdEquivalent(draft, rate)) < toCents(cash)) {
    return 'Cash received cannot be less than the cash part of the sale.'
  }
  if (draft.tenderSource === 'lbp' && draft.tenderedLbp > 0 && !rate) {
    return 'Set USD / LBP in Settings before counting payment in pounds.'
  }
  if (draft.changeLbp > 0) {
    if (!rate) return 'Set USD / LBP in Settings before giving change in pounds.'
    const changeUsd = changeDue(draft, total, rate)
    const changeUsdFromLbp = changeLbpUsd(draft.changeLbp, rate)
    if (changeUsdFromLbp === null || changeUsdFromLbp <= 0) return 'Enter change in pounds as a whole number.'
    if (toCents(changeUsdFromLbp) > toCents(changeUsd)) {
      return 'Change in pounds cannot be more than the change due in dollars.'
    }
  }
  return null
}

/** The `payments` array for `POST /sales`: only the parts above zero are sent. */
export function paymentsFor(
  draft: PaymentDraft,
  total: number,
  rate: number | null = null,
) {
  const { cash, whish } = amountsOf(draft, total)
  const payments: {
    method: 'cash' | 'whish'
    amount: number
    tendered?: number
    reference?: string
    currency?: 'USD' | 'LBP'
    changeLbp?: number
  }[] = []
  if (toCents(cash) > 0) {
    if (draft.payInLbp && draft.mode === 'cash' && whish === 0) {
      payments.push({ method: 'cash', amount: cash, currency: 'LBP' })
    } else {
      const changeUsdInLbp =
        draft.changeLbp > 0 && rate ? (changeLbpUsd(draft.changeLbp, rate) ?? undefined) : undefined
      payments.push({
        method: 'cash',
        amount: cash,
        ...(draft.payInLbp ? {} : { tendered: Math.max(cash, tenderedUsdEquivalent(draft, rate)) }),
        ...(changeUsdInLbp && changeUsdInLbp > 0 ? { changeLbp: changeUsdInLbp } : {}),
      })
    }
  }
  if (toCents(whish) > 0) {
    payments.push({ method: 'whish', amount: whish, reference: draft.whishReference.trim() })
  }
  return payments
}

/**
 * Cash received follows the sale total until the cashier types a larger bill.
 * The same draft is returned when nothing has to change, so the till can call
 * this from an effect without looping.
 */
export function syncTendered(draft: PaymentDraft, total: number, rate: number | null = null): PaymentDraft {
  const { cash } = amountsOf(draft, total)
  if (toCents(tenderedUsdEquivalent(draft, rate)) >= toCents(cash)) return draft
  const tendered = cash
  return {
    ...draft,
    tendered,
    tenderedLbp: draft.tenderSource === 'lbp' ? (usdToLbp(tendered, rate) ?? 0) : 0,
  }
}

/** A sale's payments as `GET /sales` returns them. */
interface SalePayment {
  method: string
  amount: string | number
}

/** Cents taken by one method across a sale's payments. */
export function paymentCents(payments: readonly SalePayment[], method: 'cash' | 'whish'): number {
  return payments
    .filter((payment) => payment.method === method)
    .reduce((sum, payment) => sum + toCents(Number(payment.amount) || 0), 0)
}

/** How a sale was paid: one method, or both. */
export function salePaymentKind(payments: readonly SalePayment[]): 'cash' | 'whish' | 'split' {
  const cash = paymentCents(payments, 'cash')
  const whish = paymentCents(payments, 'whish')
  if (cash > 0 && whish > 0) return 'split'
  return whish > 0 ? 'whish' : 'cash'
}

/** Short label for lists: Cash, Whish, Cash + Whish, or. when nothing is stored. */
export function paymentMethodLabel(draft: PaymentDraft | undefined, total: number): string {
  if (!draft || toCents(total) <= 0) return ''
  const { cash, whish } = amountsOf(draft, total)
  const cashC = toCents(cash)
  const whishC = toCents(whish)
  if (cashC > 0 && whishC > 0) return 'Cash + Whish'
  if (whishC > 0) return 'Whish'
  if (cashC > 0) return 'Cash'
  return ''
}
