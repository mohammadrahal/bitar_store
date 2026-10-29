import { delay, delayedFailure } from '@/lib/delay'
import { createId } from '@/lib/ids'
import { commitDb, readDb, type MockDb } from '@/mocks/store'
import { actorName, branchNameOf, visibleBranchIds } from '@/services/mock-ledger'
import { permissionError } from '@/services/transfer-helpers'
import {
  ALL_BRANCHES,
  type BranchScope,
  type ReplenishmentRequest,
  type ReplenishmentRequestRow,
  type ReplenishmentStatus,
} from '@/types'

/*
 * BL-05's manual flow: a branch asks the warehouse for stock, and a super
 * admin or manager approves it whole, approves part of it, or rejects it with a
 * reason. A low-stock threshold never raises a request by itself.
 *
 * There is no endpoint for any of this, so it lives in the local ledger and the
 * screen is marked Preview. Nothing here moves stock; an approved request is
 * fulfilled by a transfer.
 */

function nextNumber(db: MockDb): string {
  const seq = db.replenishmentSeq
  db.replenishmentSeq = seq + 1
  return `RR-${String(seq).padStart(4, '0')}`
}

function toRow(db: MockDb, request: ReplenishmentRequest): ReplenishmentRequestRow {
  return {
    ...request,
    lines: request.lines.map((line) => {
      const variant = db.variants.find((candidate) => candidate.id === line.variantId)
      const product = variant && db.products.find((candidate) => candidate.id === variant.productId)
      return {
        ...line,
        sku: variant?.sku ?? line.variantId,
        label: variant && product ? `${product.name} ${variant.color} / ${variant.size}` : 'Unknown variant',
      }
    }),
    branchName: branchNameOf(db, request.branchId),
    requestedUnits: request.lines.reduce((sum, line) => sum + line.requested, 0),
    approvedUnits: request.lines.reduce((sum, line) => sum + line.approved, 0),
  }
}

export interface ReplenishmentRequestQuery {
  scope: BranchScope
  status?: ReplenishmentStatus | 'open' | 'all'
}

const OPEN_STATUSES: ReplenishmentStatus[] = ['requested', 'approved']

export async function listReplenishmentRequests(
  query: ReplenishmentRequestQuery,
): Promise<ReplenishmentRequestRow[]> {
  const db = readDb()
  const visible = new Set(visibleBranchIds(db))
  const status = query.status ?? 'all'

  const rows = db.replenishmentRequests
    .filter((request) => visible.has(request.branchId))
    .filter((request) => query.scope === ALL_BRANCHES || request.branchId === query.scope)
    .filter((request) => {
      if (status === 'all') return true
      if (status === 'open') return OPEN_STATUSES.includes(request.status)
      return request.status === status
    })
    .map((request) => toRow(db, request))
    .sort((a, b) => b.number.localeCompare(a.number))

  return delay(rows)
}

export interface NewReplenishmentRequest {
  branchId: string
  reason: string
  lines: { variantId: string; quantity: number }[]
}

export async function createReplenishmentRequest(
  input: NewReplenishmentRequest,
): Promise<ReplenishmentRequestRow> {
  const db = readDb()
  const denied = permissionError('movements.request', input.branchId, db)
  if (denied) return delayedFailure(denied)

  const lines = input.lines
    .filter((line) => line.quantity > 0)
    .map((line) => ({ variantId: line.variantId, requested: Math.floor(line.quantity), approved: 0 }))
  if (lines.length === 0) return delayedFailure('Add at least one variant with a quantity.')
  if (!input.reason.trim()) return delayedFailure('Say why this stock is needed.')

  const request: ReplenishmentRequest = {
    id: createId('rr'),
    number: nextNumber(db),
    branchId: input.branchId,
    reason: input.reason.trim(),
    status: 'requested',
    lines,
    requestedBy: actorName(),
    requestedAt: new Date().toISOString(),
  }
  db.replenishmentRequests.push(request)
  commitDb(db)
  return delay(toRow(db, request))
}

export interface ReplenishmentDecision {
  requestId: string
  /** What the reviewer allows per variant. Everything at zero is a rejection. */
  approved: Record<string, number>
  /** Required when nothing is approved. */
  reason?: string
}

/** Approve all or part, or reject with a reason. Only an owner role may decide. */
export async function reviewReplenishmentRequest(
  decision: ReplenishmentDecision,
): Promise<ReplenishmentRequestRow> {
  const db = readDb()
  const request = db.replenishmentRequests.find((candidate) => candidate.id === decision.requestId)
  if (!request) return delayedFailure('This request no longer exists.')
  if (request.status !== 'requested') return delayedFailure('This request has already been decided.')

  const denied = permissionError('replenishment.review', request.branchId, db)
  if (denied) return delayedFailure(denied)

  for (const line of request.lines) {
    const allowed = Math.floor(decision.approved[line.variantId] ?? 0)
    if (allowed < 0) return delayedFailure('An approved quantity cannot be negative.')
    if (allowed > line.requested) return delayedFailure('You cannot approve more than was asked for.')
    line.approved = allowed
  }

  const total = request.lines.reduce((sum, line) => sum + line.approved, 0)
  if (total === 0 && !decision.reason?.trim()) {
    return delayedFailure('Rejecting a request needs a reason.')
  }

  request.status = total === 0 ? 'rejected' : 'approved'
  request.reviewedBy = actorName()
  request.reviewedAt = new Date().toISOString()
  request.decisionReason = decision.reason?.trim() || undefined
  commitDb(db)
  return delay(toRow(db, request))
}

/** The approved units have arrived, so the request is done (BL-010 section 5). */
export async function completeReplenishmentRequest(requestId: string): Promise<ReplenishmentRequestRow> {
  const db = readDb()
  const request = db.replenishmentRequests.find((candidate) => candidate.id === requestId)
  if (!request) return delayedFailure('This request no longer exists.')
  if (request.status !== 'approved') return delayedFailure('Only an approved request can be completed.')

  const denied = permissionError('replenishment.review', request.branchId, db)
  if (denied) return delayedFailure(denied)

  request.status = 'completed'
  commitDb(db)
  return delay(toRow(db, request))
}

/** The branch no longer needs it. Open requests only. */
export async function cancelReplenishmentRequest(requestId: string): Promise<ReplenishmentRequestRow> {
  const db = readDb()
  const request = db.replenishmentRequests.find((candidate) => candidate.id === requestId)
  if (!request) return delayedFailure('This request no longer exists.')
  if (!OPEN_STATUSES.includes(request.status)) return delayedFailure('This request is already closed.')

  const denied =
    permissionError('movements.request', request.branchId, db) &&
    permissionError('replenishment.review', request.branchId, db)
  if (denied) return delayedFailure(denied)

  request.status = 'cancelled'
  commitDb(db)
  return delay(toRow(db, request))
}
