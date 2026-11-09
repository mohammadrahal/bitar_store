import type { ApiTransfer } from '@/lib/api/types'
import { isDraftVisibleAtBranch, listTransfersPage } from '@/services/transfers.service'
import { ALL_BRANCHES, type BranchScope } from '@/types'

export const NO_BRANCH_SCOPE = '__none__' as const

export function isScopedBranch(scope: BranchScope): scope is string {
  return scope !== ALL_BRANCHES && scope !== NO_BRANCH_SCOPE
}

/**
 * What is waiting for someone, counted from the endpoints the backend actually
 * has.
 *
 * The brief asked for six rows. Three of them have no endpoint on this API —
 * supplier receipts, discount and refund requests, and social media orders with
 * a pickup time. so they are absent here rather than stubbed: a row that
 * always reads zero tells a manager everything is handled when nobody can know
 * that. The missing routes are listed in `ARCHITECTURE.md` section 9.
 */
export type AttentionKey = 'transfer_approvals' | 'in_transit' | 'low_stock'

export interface AttentionCount {
  key: AttentionKey
  count: number
  /** A second figure the row mentions in passing, such as how many are overdue. */
  detail?: number
}

/**
 * How long a dispatched transfer may sit before the list calls it overdue.
 *
 * The API carries no expected-arrival date. `dispatchedAt` is all there is —
 * so this is the frontend's own threshold rather than a fact from the server,
 * and the row says "on the road over N days" instead of implying a missed date
 * the backend knows about.
 */
export const OVERDUE_DAYS = 3

function daysSince(iso: string | null, now: number): number {
  if (!iso) return 0
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return 0
  return (now - then) / 86_400_000
}

export interface TransferAttention {
  /** Drafts: prepared or requested, waiting to be sent or cancelled. */
  awaitingApproval: number
  /** Dispatched or partly received: units on the road. */
  onTheRoad: number
  /** Dispatched or partly received where this branch is the destination. */
  incomingOnRoad: number
}

function branchParam(scope: BranchScope) {
  return scope === ALL_BRANCHES ? undefined : scope
}

/**
 * The two figures the nav rail and the bell badge carry.
 *
 * Three reads, because `GET /transfers` takes one `status` at a time and
 * "on the road" is `dispatched` plus `partially_received`. All three ask for
 * `limit=1`: the whole count arrives in `X-Total-Count`, so the body is a
 * two-byte `[]` and no transfer document is transferred to show a number.
 *
 * The rail lives in the dashboard layout, so this runs on every screen. That is
 * what makes the payload worth caring about. see {@link getOverdueTransfers},
 * which is the part that does need the documents and is asked for separately.
 */
export async function getTransferAttention(scope: BranchScope): Promise<TransferAttention> {
  const branchId = branchParam(scope)

  const hasUnitsOnRoad = (transfer: ApiTransfer) => transfer.totals.onTheRoad > 0
  const onTheRoad = await Promise.all([
    countTransfersMatching(branchId, 'dispatched', hasUnitsOnRoad),
    countTransfersMatching(branchId, 'partially_received', hasUnitsOnRoad),
  ]).then(([dispatched, partial]) => dispatched + partial)

  let incomingOnRoad = 0
  if (branchId) {
    const isIncomingOnRoad = (transfer: ApiTransfer) => transfer.to.id === branchId && transfer.totals.onTheRoad > 0
    incomingOnRoad = await Promise.all([
      countTransfersMatching(branchId, 'dispatched', isIncomingOnRoad),
      countTransfersMatching(branchId, 'partially_received', isIncomingOnRoad),
    ]).then(([a, b]) => a + b)
  }

  const awaitingApproval = branchId
    ? await countTransfersMatching(branchId, 'draft', (transfer) => isDraftVisibleAtBranch(transfer, branchId))
    : (await listTransfersPage({ status: 'draft', limit: 1 })).total

  return {
    awaitingApproval,
    onTheRoad,
    incomingOnRoad,
  }
}

/** The API's largest page. */
const SCAN_PAGE = 200

/* 40 000 shipments on the road at once is not a state this business reaches, so
   the scan stops there rather than paging for ever against a runaway list. If it
   ever did, the figure would read low rather than wrong-shaped. */
const MAX_SCAN_PAGES = 200

async function countTransfersMatching(
  branchId: string | undefined,
  status: 'draft' | 'dispatched' | 'partially_received',
  match: (transfer: ApiTransfer) => boolean,
): Promise<number> {
  let count = 0
  for (let page = 0; page < MAX_SCAN_PAGES; page += 1) {
    const offset = page * SCAN_PAGE
    const { items, total } = await listTransfersPage({
      ...(branchId ? { branchId } : {}),
      status,
      limit: SCAN_PAGE,
      offset,
    })
    for (const transfer of items) {
      if (match(transfer)) count += 1
    }
    if (items.length < SCAN_PAGE || offset + items.length >= total) break
  }
  return count
}

async function countOverdue(branchId: string | undefined, status: 'dispatched' | 'partially_received', now: number) {
  let overdue = 0
  for (let page = 0; page < MAX_SCAN_PAGES; page += 1) {
    const offset = page * SCAN_PAGE
    const { items, total } = await listTransfersPage({ branchId, status, limit: SCAN_PAGE, offset })
    for (const transfer of items) {
      if (transfer.totals.onTheRoad > 0 && daysSince(transfer.dispatchedAt, now) > OVERDUE_DAYS) overdue += 1
    }
    if (items.length < SCAN_PAGE || offset + items.length >= total) break
  }
  return overdue
}

/**
 * How many of the shipments on the road left more than {@link OVERDUE_DAYS} ago.
 *
 * The server cannot filter by age, so this is the one figure that needs the
 * dispatch dates themselves. It is read to the end of the list on purpose: the
 * list is newest first, so the overdue ones sit at the *back* of it, and a
 * single capped page would have cut off precisely the transfers being counted
 * and reported zero overdue while several were.
 */
export async function getOverdueTransfers(scope: BranchScope): Promise<number> {
  const branchId = branchParam(scope)
  const now = Date.now()
  const [dispatched, partial] = await Promise.all([
    countOverdue(branchId, 'dispatched', now),
    countOverdue(branchId, 'partially_received', now),
  ])
  return dispatched + partial
}
