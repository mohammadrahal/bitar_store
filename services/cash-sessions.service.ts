import { getApiClient } from '@/lib/api'
import { cashSessionTotals } from '@/lib/cash-display'
import { priceOf, priceText } from '@/lib/api/map-catalog'
import { statusOf } from '@/lib/errors'
import type {
  ApiCashSession,
  ApiCashSessionSummary,
  CashCorrectionInput,
  CashMovementDirection,
  ListCashSessionsParams,
} from '@/lib/api/types'

/**
 * The drawer, over `/cash-sessions`.
 *
 * A till sale is attached to the branch's open session **by the server**, so
 * `POST /sales` sends nothing extra and this module is never in the sale path.
 * What it covers is the shift around the sales: opening the drawer, cash in and
 * out, handing it to the next person, closing it, and a manager's corrections.
 *
 * Two rules worth stating once, because every screen depends on them:
 *
 * - **Expected cash** = opening + cash payments + cash in - cash out.
 * - **Whish never changes the drawer.** It is reported beside the cash so a
 *   shift can be read in full, but it is not in `expectedCash`, and a Whish
 *   payment must never be counted as a note in the till.
 */

/** Money goes to the API as text with two decimals, like every other amount. */
function amount(value: string | number): string {
  return typeof value === 'number' ? priceText(value) : value
}

/**
 * `GET /cash-sessions/current?branchId=`: the open session, or `null`.
 *
 * `null` is the normal answer before the first drawer of the day, not a
 * failure. A server without the route yet also answers `null` rather than
 * blocking the till, since `requireOpenCashSession` cannot be on there either.
 */
export async function getCurrentCashSession(branchId: string): Promise<ApiCashSession | null> {
  if (!branchId) return null
  try {
    return (await getApiClient().getCurrentCashSession(branchId)) ?? null
  } catch (error) {
    if (statusOf(error) === 404) return null
    throw error
  }
}

export async function getCashSession(id: string): Promise<ApiCashSession> {
  return getApiClient().getCashSession(id)
}

/** `GET /cash-sessions`. The manager's list; `review: 'flagged'` is the to-review one. */
export async function listCashSessions(params: ListCashSessionsParams = {}) {
  return getApiClient().listCashSessionsPage({ limit: 20, ...params })
}

/** Needs `cash.open`. The opening float is what is in the drawer before the first sale. */
export async function openCashSession(
  input: { branchId: string; openingCash: number; note?: string },
  idempotencyKey: string,
): Promise<ApiCashSession> {
  if (input.openingCash < 0) throw new Error('An opening float cannot be negative.')
  return getApiClient().openCashSession(
    {
      branchId: input.branchId,
      openingCash: amount(input.openingCash),
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    },
    idempotencyKey,
  )
}

/**
 * Needs `cash.move`. Cash taken out of the drawer or put into it outside a
 * sale, with the reason that goes in the audit log. The server answers **409**
 * when more is taken out than the drawer is expected to hold.
 */
export async function recordCashMovement(
  id: string,
  input: { direction: CashMovementDirection; amount: number; reason: string },
  idempotencyKey: string,
): Promise<ApiCashSession> {
  if (input.amount <= 0) throw new Error('Enter how much cash is moving.')
  if (!input.reason.trim()) throw new Error('Say why the cash is moving. It goes in the record.')
  return getApiClient().recordCashMovement(
    id,
    { direction: input.direction, amount: amount(input.amount), reason: input.reason.trim() },
    idempotencyKey,
  )
}

/**
 * Needs `cash.accept`, and is sent by the person **taking** the drawer, after
 * counting it. A count that does not match the expected cash needs the note, or
 * the server answers 400. Logging out is not a handover.
 */
export async function handOverCashSession(
  id: string,
  input: { countedCash: number; note?: string },
  idempotencyKey: string,
): Promise<ApiCashSession> {
  if (input.countedCash < 0) throw new Error('A count cannot be negative.')
  return getApiClient().handOverCashSession(
    id,
    { countedCash: amount(input.countedCash), ...(input.note?.trim() ? { note: input.note.trim() } : {}) },
    idempotencyKey,
  )
}

/**
 * Needs `cash.close`. A difference requires `differenceNote` but never blocks
 * the closing: the shift ends either way and the manager reviews it after.
 */
export async function closeCashSession(
  id: string,
  input: { countedCash: number; cashRemoved?: number; differenceNote?: string },
  idempotencyKey: string,
): Promise<ApiCashSession> {
  if (input.countedCash < 0) throw new Error('A count cannot be negative.')
  if ((input.cashRemoved ?? 0) < 0) throw new Error('Cash taken out cannot be negative.')
  if ((input.cashRemoved ?? 0) > input.countedCash) {
    throw new Error('You cannot take out more than you counted.')
  }
  return getApiClient().closeCashSession(
    id,
    {
      countedCash: amount(input.countedCash),
      ...(input.cashRemoved !== undefined ? { cashRemoved: amount(input.cashRemoved) } : {}),
      ...(input.differenceNote?.trim() ? { differenceNote: input.differenceNote.trim() } : {}),
    },
    idempotencyKey,
  )
}

/** Manager only, on a closed session. The original `closing` is kept beside `effective`. */
export async function correctCashSession(
  id: string,
  input: { field: CashCorrectionInput['field']; value: number; reason: string },
  idempotencyKey: string,
): Promise<ApiCashSession> {
  if (!input.reason.trim()) throw new Error('A correction needs a reason.')
  return getApiClient().correctCashSession(
    id,
    { field: input.field, value: amount(input.value), reason: input.reason.trim() },
    idempotencyKey,
  )
}

/** Manager only: sign off a flagged session. */
export async function reviewCashSession(id: string, note?: string): Promise<ApiCashSession> {
  return getApiClient().reviewCashSession(id, note)
}

/* ---- reading a session --------------------------------------------------------------------------- */

/**
 * Expected cash, recomputed from the parts so a screen can show the sum it is
 * made of. The server's `totals.expectedCash` is the figure of record; this
 * agreeing with it is the point.
 */
export function expectedCashOf(session: ApiCashSessionSummary): number {
  const totals = cashSessionTotals(session)
  return (
    priceOf(session.openingCash) +
    priceOf(totals.cashPayments) +
    priceOf(totals.cashIn) -
    priceOf(totals.cashOut)
  )
}

/** counted - expected. Positive is a surplus in the drawer, negative is short. */
export function countDifference(counted: number, session: ApiCashSessionSummary): number {
  return counted - priceOf(cashSessionTotals(session).expectedCash)
}

/** Whether a count needs a note before it will be accepted. */
export function needsDifferenceNote(counted: number, session: ApiCashSessionSummary): boolean {
  return Math.abs(countDifference(counted, session)) >= 0.01
}

/** `POST /sales` answered 409 because this branch has no open drawer. */
export function isNoOpenCashSession(error: unknown): boolean {
  return statusOf(error) === 409 && /cash session/i.test(error instanceof Error ? error.message : '')
}

export type { ApiCashSession, ApiCashSessionSummary }
