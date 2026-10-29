import { delay, delayedFailure } from '@/lib/delay'
import { createId } from '@/lib/ids'
import { commitDb, readDb } from '@/mocks/store'
import { actorName, visibleBranchIds } from '@/services/mock-ledger'
import { permissionError } from '@/services/transfer-helpers'
import { ALL_BRANCHES, type BranchScope, type DiscountRequest } from '@/types'

/*
 * BL-04: an employee may ask for money off but never grant it. The API records
 * the approver with a line discount, but has no endpoint for the asking, so a
 * request lives in the local ledger and the till refuses to complete while one
 * is still pending. Once approved, the discount goes to `POST /sales` as a
 * normal line discount and the server records who approved it.
 */

export interface NewDiscountRequest {
  branchId: string
  variantId: string
  percent: number
  reason: string
}

export async function requestDiscount(input: NewDiscountRequest): Promise<DiscountRequest> {
  const db = readDb()
  const denied = permissionError('discounts.request', input.branchId, db)
  if (denied) return delayedFailure(denied)
  if (!(input.percent > 0) || input.percent > 100) {
    return delayedFailure('A discount must be more than 0% and at most 100%.')
  }
  if (!input.reason.trim()) return delayedFailure('Say why the discount is needed.')

  const request: DiscountRequest = {
    id: createId('dr'),
    branchId: input.branchId,
    variantId: input.variantId,
    percent: input.percent,
    reason: input.reason.trim(),
    status: 'pending',
    requestedBy: actorName(),
    requestedAt: new Date().toISOString(),
  }
  db.discountRequests.push(request)
  commitDb(db)
  return delay(request)
}

export async function listDiscountRequests(scope: BranchScope = ALL_BRANCHES): Promise<DiscountRequest[]> {
  const db = readDb()
  const visible = new Set(visibleBranchIds(db))
  return delay(
    db.discountRequests
      .filter((request) => visible.has(request.branchId))
      .filter((request) => scope === ALL_BRANCHES || request.branchId === scope)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)),
  )
}

/** What the till needs: the pending and approved asks for this location. */
export async function openDiscountRequestsAt(branchId: string): Promise<DiscountRequest[]> {
  const db = readDb()
  return delay(
    db.discountRequests.filter(
      (request) => request.branchId === branchId && request.status !== 'rejected',
    ),
  )
}

export async function decideDiscountRequest(
  requestId: string,
  approved: boolean,
): Promise<DiscountRequest> {
  const db = readDb()
  const request = db.discountRequests.find((candidate) => candidate.id === requestId)
  if (!request) return delayedFailure('This request no longer exists.')
  if (request.status !== 'pending') return delayedFailure('This request has already been decided.')

  const denied = permissionError('discounts.approve', request.branchId, db)
  if (denied) return delayedFailure(denied)

  request.status = approved ? 'approved' : 'rejected'
  request.decidedBy = actorName()
  request.decidedAt = new Date().toISOString()
  commitDb(db)
  return delay(request)
}

/** Clears the asks a completed sale has used up. */
export async function clearDiscountRequests(requestIds: string[]): Promise<void> {
  if (requestIds.length === 0) return
  const db = readDb()
  db.discountRequests = db.discountRequests.filter((request) => !requestIds.includes(request.id))
  commitDb(db)
}
