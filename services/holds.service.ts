import { delay, delayedFailure } from '@/lib/delay'
import { createId } from '@/lib/ids'
import { commitDb, readDb, type MockDb } from '@/mocks/store'
import { postAdjustments } from '@/services/adjustment-docs'
import {
  actorName,
  availableOf,
  branchNameOf,
  ensureLevel,
  levelOf,
  logMovement,
  remember,
  replayOf,
  visibleBranchIds,
} from '@/services/mock-ledger'
import { permissionError } from '@/services/transfer-helpers'
import { ALL_BRANCHES, type BranchScope, type Hold, type HoldRow } from '@/types'

function toRow(db: MockDb, hold: Hold): HoldRow {
  const variant = db.variants.find((candidate) => candidate.id === hold.variantId)
  const product = variant && db.products.find((candidate) => candidate.id === variant.productId)
  return {
    ...hold,
    productName: product?.name ?? 'Unknown product',
    sku: variant?.sku ?? hold.variantId,
    size: variant?.size ?? '',
    color: variant?.color ?? '',
    branchName: branchNameOf(db, hold.branchId),
  }
}

/** Active holds the caller can see, newest first. */
export async function listHolds(scope: BranchScope): Promise<HoldRow[]> {
  const db = readDb()
  const visible = new Set(visibleBranchIds(db))
  const rows = db.holds
    .filter((hold) => !hold.releasedAt && visible.has(hold.branchId))
    .filter((hold) => scope === ALL_BRANCHES || hold.branchId === scope)
    .map((hold) => toRow(db, hold))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return delay(rows)
}

export interface HoldInput {
  variantId: string
  branchId: string
  quantity: number
  reason: string
}

/** Held units stay on hand but leave available, so they cannot be sold or sent. */
export async function placeHold(input: HoldInput, idempotencyKey?: string): Promise<HoldRow> {
  const db = readDb()
  const replay = replayOf<HoldRow>(db, idempotencyKey)
  if (replay) return delay(replay)
  const denied = permissionError('stock:hold', input.branchId, db)
  if (denied) return delayedFailure(denied)
  const available = availableOf(levelOf(db, input.variantId, input.branchId))
  if (input.quantity < 1 || input.quantity > available) {
    return delayedFailure(`Only ${available} available here to put on hold.`)
  }

  const hold: Hold = {
    id: createId('hd'),
    variantId: input.variantId,
    branchId: input.branchId,
    quantity: input.quantity,
    reason: input.reason.trim(),
    source: 'manual',
    createdAt: new Date().toISOString(),
    createdBy: actorName(),
  }
  db.holds.push(hold)
  ensureLevel(db, input.variantId, input.branchId).onHold += input.quantity
  logMovement(db, { variantId: input.variantId, branchId: input.branchId, kind: 'hold', quantity: input.quantity, reference: 'Hold', refId: hold.id, note: hold.reason })
  const result = remember(db, idempotencyKey, toRow(db, hold))
  commitDb(db)
  return delay(result)
}

export async function releaseHold(holdId: string, idempotencyKey?: string): Promise<HoldRow> {
  const db = readDb()
  const replay = replayOf<HoldRow>(db, idempotencyKey)
  if (replay) return delay(replay)
  const hold = db.holds.find((candidate) => candidate.id === holdId)
  if (!hold || hold.releasedAt) return delayedFailure('This hold has already been released.')
  const denied = permissionError('stock:hold', hold.branchId, db)
  if (denied) return delayedFailure(denied)

  hold.releasedAt = new Date().toISOString()
  hold.releasedBy = actorName()
  const level = ensureLevel(db, hold.variantId, hold.branchId)
  level.onHold = Math.max(0, level.onHold - hold.quantity)
  logMovement(db, { variantId: hold.variantId, branchId: hold.branchId, kind: 'hold_release', quantity: hold.quantity, reference: 'Hold released', refId: hold.id })
  const result = remember(db, idempotencyKey, toRow(db, hold))
  commitDb(db)
  return delay(result)
}

export interface DisposalInput {
  variantId: string
  branchId: string
  quantity: number
  reason: string
  /** Write off units from this hold rather than from available stock. */
  holdId?: string
}

/** A separate manager action from a correction: the units are gone, and the reason says why. */
export async function disposeStock(input: DisposalInput, idempotencyKey?: string): Promise<string> {
  const db = readDb()
  const replay = replayOf<string>(db, idempotencyKey)
  if (replay) return delay(replay)
  const denied = permissionError('stock:dispose', input.branchId, db)
  if (denied) return delayedFailure(denied)
  if (input.reason.trim().length < 3) return delayedFailure('Give a reason for the disposal.')
  if (!Number.isInteger(input.quantity) || input.quantity < 1) return delayedFailure('Dispose at least one whole unit.')

  const level = ensureLevel(db, input.variantId, input.branchId)
  if (input.holdId) {
    const hold = db.holds.find((candidate) => candidate.id === input.holdId && !candidate.releasedAt)
    if (!hold) return delayedFailure('That hold has already been released.')
    if (input.quantity > hold.quantity) return delayedFailure(`Only ${hold.quantity} on this hold.`)
    hold.quantity -= input.quantity
    level.onHold -= input.quantity
    if (hold.quantity === 0) {
      hold.releasedAt = new Date().toISOString()
      hold.releasedBy = actorName()
    }
  } else {
    const available = availableOf(level)
    if (input.quantity > available) return delayedFailure(`Only ${available} available to dispose of here.`)
  }

  const [document] = postAdjustments(db, input.branchId, `Disposal: ${input.reason.trim()}`, [
    { variantId: input.variantId, delta: -input.quantity },
  ])
  const result = remember(db, idempotencyKey, document.number)
  commitDb(db)
  return delay(result)
}
