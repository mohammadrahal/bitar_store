import { getApiClient } from '@/lib/api'
import { priceOf, priceText } from '@/lib/api/map-catalog'
import { statusOf } from '@/lib/errors'
import type {
  ApiReturn,
  ApiReturnCondition,
  ApiReturnLine,
  ApiReturnableSale,
  ApiReturnStatus,
  ListReturnsParams,
} from '@/lib/api/types'

/**
 * Customer returns, over `/returns` (BL-04 rules 31 to 37).
 *
 * The one thing to hold on to: **receiving, approving, releasing and paying are
 * four separate acts, and none of them triggers another.** The server enforces
 * it — approving an unreceived return is a 409, releasing before approval is a
 * 409, paying before approval is a 409 — so a screen that tries to do two at
 * once gets an error rather than a shortcut.
 *
 * What this module deliberately does **not** do:
 *
 * - **It never computes a refund.** The amount is fixed by the server at
 *   approval, as the amount actually paid for those units after discounts, and
 *   comes back on `refund.total`. `lib/return-grades.ts` can show the figure
 *   before approval, but what is owed is whatever the server says it is.
 * - **It applies no condition haircut.** The four conditions record the state of
 *   the goods so a manager can decide whether to release them; they do not
 *   change the money by a cent.
 * - **It offers no store credit.** Customer credit is outside this MVP: a refund
 *   is cash or Whish.
 */

/** Money goes to the API as text with two decimals, like every other amount. */
function amount(value: string | number): string {
  return typeof value === 'number' ? priceText(value) : value
}

/* ------------------------------- reading ------------------------------- */

/**
 * `GET /returns/eligible?sale=` — the sale a return starts from.
 *
 * `key` is whatever the customer's receipt says: the sale id or its printed
 * number, in any case. Returns `null` when no such sale exists, because an
 * unrecognised receipt number is the counter mistyping, not an error worth a
 * red screen.
 */
export async function findReturnableSale(key: string): Promise<ApiReturnableSale | null> {
  const sale = key.trim()
  if (sale.length < 3) return null
  try {
    return await getApiClient().getReturnableSale(sale)
  } catch (error) {
    if (statusOf(error) === 404) return null
    throw error
  }
}

export async function listReturns(params: ListReturnsParams = {}) {
  return getApiClient().listReturnsPage({ limit: 20, ...params })
}

export async function getReturn(id: string): Promise<ApiReturn> {
  return getApiClient().getReturn(id)
}

/* ------------------------------- writing ------------------------------- */

export interface ReceiveReturnDraft {
  saleId: string
  receivingBranchId: string
  reason: string
  note?: string
  /** `false` when the customer is keeping the goods for now. */
  goodsInHand?: boolean
  lines: { skuId: string; quantity: number; condition: ApiReturnCondition }[]
  /** Manager-only, and only accepted past the return window. */
  lateExceptionReason?: string
}

/**
 * Needs `returns.create`. Takes the goods into custody — **no stock moves**.
 *
 * The server refuses more units than the sale still allows (409, naming what is
 * returnable), a SKU that is not on the sale (404), the warehouse as the
 * receiving branch (409), and a return past the window unless a manager sends
 * `lateExceptionReason` (409, then 403 for an employee who tries).
 */
export async function receiveReturn(
  draft: ReceiveReturnDraft,
  idempotencyKey: string,
): Promise<ApiReturn> {
  if (draft.lines.length === 0) throw new Error('Add at least one item that is coming back.')
  if (draft.lines.some((line) => line.quantity < 1)) {
    throw new Error('Every line needs at least one unit.')
  }
  if (new Set(draft.lines.map((line) => line.skuId)).size !== draft.lines.length) {
    throw new Error('Each item can appear only once on a return. Add up the units instead.')
  }
  if (draft.reason.trim().length < 3) {
    throw new Error('Say why it is coming back. It goes on the record.')
  }
  return getApiClient().receiveReturn(
    {
      saleId: draft.saleId,
      receivingBranchId: draft.receivingBranchId,
      custody: draft.goodsInHand === false ? 'customer_keeps' : 'with_branch',
      reason: draft.reason.trim(),
      ...(draft.note?.trim() ? { note: draft.note.trim() } : {}),
      lines: draft.lines,
      ...(draft.lateExceptionReason?.trim()
        ? { lateException: { reason: draft.lateExceptionReason.trim() } }
        : {}),
    },
    idempotencyKey,
  )
}

/**
 * Needs `returns.create`. Records that a customer who kept the goods has
 * brought them in, which is what unblocks approval.
 */
export async function takeReturnCustody(id: string): Promise<ApiReturn> {
  return getApiClient().takeReturnCustody(id)
}

/**
 * Manager only. The goods enter the hold at the receiving branch **once** and
 * the refund amount is fixed. It does not pay and it does not release.
 */
export async function approveReturn(
  id: string,
  reason: string | undefined,
  idempotencyKey: string,
): Promise<ApiReturn> {
  return getApiClient().approveReturn(
    id,
    reason?.trim() ? { reason: reason.trim() } : {},
    idempotencyKey,
  )
}

/** Manager only, and the reason is required. No stock moves and no refund is owed. */
export async function rejectReturn(id: string, reason: string): Promise<ApiReturn> {
  if (reason.trim().length < 3) {
    throw new Error('A rejected return needs a reason. The customer is told it.')
  }
  return getApiClient().rejectReturn(id, { reason: reason.trim() })
}

/** Needs `returns.create`. Closes a rejected return by naming who collected the goods. */
export async function handbackReturn(id: string, recipient: string): Promise<ApiReturn> {
  if (recipient.trim().length < 2) throw new Error('Write who is taking the goods away.')
  return getApiClient().handbackReturn(id, { recipient: recipient.trim() })
}

/**
 * Manager only. Moves units from hold to sellable.
 *
 * Pass nothing to release everything still on hold. The server answers 409 for
 * more than is on hold, and also when the units were adjusted out of the hold
 * in the meantime — goods that have been disposed of cannot be put back on the
 * shelf by a return.
 */
export async function releaseReturn(
  id: string,
  lines: { returnLineId: string; quantity: number }[] | undefined,
  idempotencyKey: string,
): Promise<ApiReturn> {
  if (lines && lines.length === 0) throw new Error('Choose what to release, or release everything.')
  return getApiClient().releaseReturn(id, lines ? { lines } : {}, idempotencyKey)
}

/**
 * Needs `returns.refund`, on an approved return. Pays some or all of it.
 *
 * Cash comes out of the open drawer at the paying branch, so with
 * `requireOpenCashSession` on, a cash refund with no open session is a 409
 * (`isNoOpenCashSession` from the cash service recognises it). Whish never
 * touches the drawer and needs no session.
 */
export async function payReturnRefund(
  id: string,
  input: { method: 'cash' | 'whish'; amount: number | string; recipient: string; reference?: string },
  idempotencyKey: string,
): Promise<ApiReturn> {
  const value = typeof input.amount === 'number' ? input.amount : priceOf(input.amount)
  if (value <= 0) throw new Error('Enter how much is being handed back.')
  if (input.recipient.trim().length < 2) throw new Error('Write who is receiving the money.')
  if (input.method === 'cash' && input.reference?.trim()) {
    throw new Error('A cash refund has no reference. Leave it empty.')
  }
  return getApiClient().payReturnRefund(
    id,
    {
      method: input.method,
      amount: amount(input.amount),
      recipient: input.recipient.trim(),
      ...(input.method === 'whish' && input.reference?.trim()
        ? { reference: input.reference.trim() }
        : {}),
    },
    idempotencyKey,
  )
}

/**
 * Links the replacement sale to an approved return (rule 36) and records the
 * net. It neither pays the refund nor releases the goods.
 *
 * The sale has to be at the receiving branch, rung up **after** the goods came
 * in, and not already the exchange of another return — each of which the server
 * refuses with 409 and an explanation.
 */
export async function linkReturnExchange(id: string, saleId: string): Promise<ApiReturn> {
  return getApiClient().linkReturnExchange(id, { saleId })
}

/* ------------------------------ reading it ----------------------------- */

export const RETURN_STATUS_LABELS: Record<ApiReturnStatus, string> = {
  in_custody: 'In custody',
  approved: 'Approved',
  rejected: 'Rejected',
  handed_back: 'Handed back',
}

/**
 * The server's four conditions.
 *
 * `hint` says where the unit is likely to go, not what it is worth: the refund
 * is the amount paid whatever state the goods are in. Only `as_new` is an
 * obvious candidate for release to the shelf; the rest are a manager's call.
 */
export const RETURN_CONDITION_OPTIONS: { value: ApiReturnCondition; label: string; hint: string }[] = [
  { value: 'as_new', label: 'As new', hint: 'Tags on, saleable as it stands.' },
  { value: 'minor_flaws', label: 'Minor flaws', hint: 'Saleable, perhaps at a discount. A manager decides.' },
  { value: 'needs_repair', label: 'Needs repair', hint: 'Not saleable until it is mended. Stays on hold.' },
  { value: 'damaged', label: 'Damaged', hint: 'Not for sale. Stays on hold until it is written off.' },
]

export function returnConditionLabel(condition: ApiReturnCondition): string {
  return RETURN_CONDITION_OPTIONS.find((option) => option.value === condition)?.label ?? condition
}

/** Units approved and not yet on the shelf — what `release` can still move. */
export function unitsOnHold(entry: ApiReturn): number {
  return entry.lines.reduce((total, line) => total + line.onHold, 0)
}

export function unitsReturned(entry: ApiReturn): number {
  return entry.lines.reduce((total, line) => total + line.quantity, 0)
}

/** Lines with something still on hold, which is what a release form offers. */
export function releasableLines(entry: ApiReturn): ApiReturnLine[] {
  return entry.lines.filter((line) => line.onHold > 0)
}

/** What may still be paid. `0` when there is no refund, or it is settled. */
export function refundOutstanding(entry: ApiReturn): number {
  return entry.refund ? priceOf(entry.refund.outstanding) : 0
}

export function canApproveReturn(entry: ApiReturn): boolean {
  return entry.status === 'in_custody' && entry.custody === 'with_branch'
}

/** A return the customer started but whose goods never arrived. */
export function awaitsGoods(entry: ApiReturn): boolean {
  return entry.status === 'in_custody' && entry.custody === 'customer_keeps'
}

export function canReleaseReturn(entry: ApiReturn): boolean {
  return entry.status === 'approved' && unitsOnHold(entry) > 0
}

export function canRefundReturn(entry: ApiReturn): boolean {
  return entry.status === 'approved' && refundOutstanding(entry) > 0
}

export function canHandBackReturn(entry: ApiReturn): boolean {
  return entry.status === 'rejected'
}

/** An approved return takes an exchange, and only one. */
export function canLinkExchange(entry: ApiReturn): boolean {
  return entry.status === 'approved' && entry.exchange === null
}

/**
 * Past the return window, so receiving needs a manager's written exception.
 *
 * `withinPeriod` comes from the server against `returnPeriodDays` in settings,
 * counted in shop days — so this is never recomputed from the browser clock.
 */
export function needsLateException(sale: ApiReturnableSale): boolean {
  return !sale.withinPeriod
}

/** Nothing left to bring back on this sale. */
export function fullyReturned(sale: ApiReturnableSale): boolean {
  return sale.lines.every((line) => line.returnable === 0)
}
