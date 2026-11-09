/*
 * Returns, as BL-04 rules 31 to 37 actually write them.
 *
 * This file used to price a return by a condition **grade** — 100 / 80 / 50 / 0
 * percent of what the customer paid — and add a 10% bonus for taking store
 * credit. Neither the grade haircut nor the bonus is in any approved rule, and
 * both changed the money. Rule 35 is explicit: the refund is **the amount
 * actually paid after discounts**, with a sale-wide discount shared
 * proportionally when only part of the sale comes back. So the condition now
 * decides only **where the unit goes** (rule 33), never what it is worth.
 *
 * The API has no returns resource (`ARCHITECTURE.md` §9 item 6), so nothing
 * here records anything. It exists so the screen shows the right numbers.
 *
 * Money is summed in whole cents, like the till.
 */

import { fromCents, toCents } from '@/lib/money'

/**
 * The condition recorded on a returned unit (rule 31).
 *
 * The rules require a condition to be recorded but do not enumerate one, so
 * these are the two the stock model already has: the sellable bucket and the
 * non-sellable one. A finer grading is **not specified**.
 */
export type ReturnCondition = 'sellable' | 'damaged'

export interface ReturnConditionRule {
  value: ReturnCondition
  label: string
  /** Where the unit goes once the return is approved and stock is released. */
  destination: string
  pillClass: string
}

export const RETURN_CONDITIONS: ReturnConditionRule[] = [
  {
    value: 'sellable',
    label: 'Sellable',
    destination: 'Business-owned on hold, until a manager releases it to the shelf',
    pillClass: 'pill-healthy',
  },
  {
    value: 'damaged',
    label: 'Damaged',
    destination: 'Business-owned on hold, and not released for sale',
    pillClass: 'pill-out',
  },
]

export function returnConditionRule(condition: ReturnCondition): ReturnConditionRule {
  return RETURN_CONDITIONS.find((rule) => rule.value === condition) ?? RETURN_CONDITIONS[0]
}

/**
 * The manager's decision on a return (rule 33). Approving and rejecting are the
 * only two outcomes the rules define, and neither one pays a refund or moves
 * stock by itself — those are separate actions (rule 34).
 */
export type ReturnDecision = 'approve' | 'reject'

export interface ReturnDecisionRule {
  value: ReturnDecision
  label: string
  hint: string
}

export const RETURN_DECISIONS: ReturnDecisionRule[] = [
  {
    value: 'approve',
    label: 'Approve the return',
    hint: 'Goods move once from custody to business-owned on hold, and a refund obligation is recorded. The refund is not paid by this step.',
  },
  {
    value: 'reject',
    label: 'Reject the return',
    hint: 'Needs a manager reason. Status becomes awaiting handback, no refund is owed, and stock is untouched.',
  },
]

export function returnDecisionRule(decision: ReturnDecision): ReturnDecisionRule {
  return RETURN_DECISIONS.find((rule) => rule.value === decision) ?? RETURN_DECISIONS[0]
}

/**
 * How the refund is paid (rule 48): back through the original method, limited
 * per method on a split payment. A different allocation needs a manager reason.
 *
 * Store credit is **not specified** by any approved rule and is therefore not
 * offered here.
 */
export type RefundMethod = 'cash' | 'whish'

export const REFUND_METHOD_LABELS: Record<RefundMethod, string> = {
  cash: 'Cash',
  whish: 'Whish',
}

/** Rule 35: pending until it is actually paid. */
export type RefundStatus = 'pending' | 'paid'

export interface ReturnSettlement {
  /** Units × what one unit was paid, before any sale-wide discount share. */
  linePaid: number
  /** This return's proportional share of a discount applied to the whole sale. */
  discountShare: number
  /** What the customer is owed: rule 35, the amount actually paid. */
  refundDue: number
}

/**
 * What a return is worth back to the customer (rule 35).
 *
 * `unitPaid` is already net of any **line** discount — that is what the till
 * saved on the line. A discount applied to the **whole sale** is not on any one
 * line, so a partial return carries its share in proportion to the value coming
 * back:
 *
 *     share = saleDiscount × (linePaid / salePaidBeforeSaleDiscount)
 *
 * Returning everything therefore gives back exactly what was paid, and
 * returning one of three units gives back a third of the sale-wide discount —
 * never the whole of it, which would refund more than was taken.
 */
export function settleReturn({
  unitPaid,
  units,
  saleDiscount = 0,
  salePaidBeforeSaleDiscount = 0,
}: {
  unitPaid: number
  units: number
  /** A discount applied across the whole sale, not to one line. */
  saleDiscount?: number
  /** Every line's paid value on the original sale, before `saleDiscount`. */
  salePaidBeforeSaleDiscount?: number
}): ReturnSettlement {
  const lineCents = toCents(unitPaid) * Math.max(0, units)
  const saleDiscountCents = toCents(saleDiscount)
  const saleBaseCents = toCents(salePaidBeforeSaleDiscount)

  const shareCents =
    saleDiscountCents > 0 && saleBaseCents > 0
      ? Math.min(lineCents, Math.round((saleDiscountCents * lineCents) / saleBaseCents))
      : 0

  return {
    linePaid: fromCents(lineCents),
    discountShare: fromCents(shareCents),
    refundDue: fromCents(Math.max(0, lineCents - shareCents)),
  }
}

/**
 * Rule 35: total refunds can never exceed what was paid, less what has already
 * been refunded. Returns the amount that may still be refunded.
 */
export function refundableRemaining({
  paid,
  alreadyRefunded,
}: {
  paid: number
  alreadyRefunded: number
}): number {
  return fromCents(Math.max(0, toCents(paid) - toCents(alreadyRefunded)))
}

/**
 * Rule 36: an exchange is a linked return plus a new sale, and the screen shows
 * the net. Positive means the customer pays the difference, negative means they
 * are owed it.
 */
export function exchangeNet({ refundDue, replacementPrice }: { refundDue: number; replacementPrice: number }): number {
  return fromCents(toCents(replacementPrice) - toCents(refundDue))
}

/**
 * Rule 34: four separate actions, none of which triggers another. Listed so the
 * screen can show them as four steps rather than one button that does
 * everything.
 */
export const RETURN_ACTION_SEQUENCE = [
  { key: 'return_decision', label: 'Return decision', hint: 'A manager approves or rejects the return.' },
  { key: 'refund_approval', label: 'Refund approval', hint: 'A manager approves the refund obligation. Separate from the return decision.' },
  { key: 'refund_payment', label: 'Refund payment', hint: 'The money is handed back, in the currently open cash session.' },
  { key: 'stock_release', label: 'Stock release', hint: 'A manager releases the unit from hold to the shelf. Never automatic.' },
] as const
