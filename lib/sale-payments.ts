import { fromCents, toCents } from '@/lib/invoice-totals'

export type PaymentMode = 'cash' | 'whish' | 'split'

/** What the payment block holds while the cashier fills it in. */
export interface PaymentDraft {
  mode: PaymentMode
  /** Taken in cash. Equals the total unless the sale is split. */
  cashAmount: number
  /** What the customer handed over. Change is the difference, and is not revenue. */
  tendered: number
  /** Taken through Whish. */
  whishAmount: number
  whishReference: string
}

export function emptyPayment(): PaymentDraft {
  return { mode: 'cash', cashAmount: 0, tendered: 0, whishAmount: 0, whishReference: '' }
}

/** The amount each method covers, with the single-method cases filled in for you. */
export function amountsOf(draft: PaymentDraft, total: number): { cash: number; whish: number } {
  if (draft.mode === 'cash') return { cash: total, whish: 0 }
  if (draft.mode === 'whish') return { cash: 0, whish: total }
  return { cash: draft.cashAmount, whish: draft.whishAmount }
}

export function changeDue(draft: PaymentDraft, total: number): number {
  const { cash } = amountsOf(draft, total)
  return Math.max(0, fromCents(toCents(draft.tendered) - toCents(cash)))
}

/**
 * Why the sale cannot be completed yet, or null when the payment is good. A
 * completed sale has to be paid in full, so the parts must add up to the total
 * exactly; cents are compared as integers so a split never fails on a float.
 */
export function paymentProblem(draft: PaymentDraft, total: number): string | null {
  const { cash, whish } = amountsOf(draft, total)
  const totalCents = toCents(total)

  if (totalCents <= 0) return 'Add an item before taking payment.'
  if (cash < 0 || whish < 0) return 'A payment cannot be negative.'
  if (toCents(cash) + toCents(whish) !== totalCents) {
    return `The payments must add up to ${fromCents(totalCents).toFixed(2)}.`
  }
  if (whish > 0 && draft.whishReference.trim() === '') return 'Enter the Whish reference.'
  if (cash > 0 && toCents(draft.tendered) < toCents(cash)) {
    return 'Cash tendered cannot be less than the cash part of the sale.'
  }
  return null
}

/** The `payments` array for `POST /sales`: only the parts above zero are sent. */
export function paymentsFor(draft: PaymentDraft, total: number) {
  const { cash, whish } = amountsOf(draft, total)
  const payments: { method: 'cash' | 'whish'; amount: number; tendered?: number; reference?: string }[] = []
  if (toCents(cash) > 0) {
    payments.push({ method: 'cash', amount: cash, tendered: Math.max(cash, draft.tendered) })
  }
  if (toCents(whish) > 0) {
    payments.push({ method: 'whish', amount: whish, reference: draft.whishReference.trim() })
  }
  return payments
}
