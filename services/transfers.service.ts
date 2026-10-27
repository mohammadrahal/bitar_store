import { delay, delayedFailure } from '@/lib/delay'
import { createId } from '@/lib/ids'
import { canCancelTransfer, isOpenTransfer, lineStillReserved } from '@/lib/transfers'
import { commitDb, readDb } from '@/mocks/store'
import { availableOf, ensureLevel, levelOf, logMovement, remember, replayOf } from '@/services/mock-ledger'
import {
  canSeeTransfer,
  logEvent,
  permissionError,
  runTransferAction,
  toRow,
  withLinks,
} from '@/services/transfer-helpers'
import { ALL_BRANCHES, type BranchScope, type Transfer, type TransferRow, type TransferStatus, type TransferWithLinks } from '@/types'

export { approveTransfer, dispatchTransfer, receiveTransfer, releaseReserved, reportDiscrepancy } from '@/services/transfer-actions.service'

export interface TransferQuery {
  scope: BranchScope
  status: TransferStatus | 'open' | 'all'
}

export async function listTransfers(query: TransferQuery): Promise<TransferRow[]> {
  const db = readDb()
  const rows = db.transfers
    .filter(canSeeTransfer)
    .filter(
      (transfer) =>
        query.scope === ALL_BRANCHES || transfer.fromBranchId === query.scope || transfer.toBranchId === query.scope,
    )
    .filter((transfer) => {
      if (query.status === 'all') return true
      if (query.status === 'open') return isOpenTransfer(transfer.status)
      return transfer.status === query.status
    })
    .map((transfer) => toRow(db, transfer))
    .sort((a, b) => b.number.localeCompare(a.number))
  return delay(rows)
}

export async function getTransfer(transferId: string): Promise<TransferWithLinks> {
  const db = readDb()
  const transfer = db.transfers.find((candidate) => candidate.id === transferId)
  if (!transfer) return delayedFailure('This transfer no longer exists.')
  if (!canSeeTransfer(transfer)) return delayedFailure("You don't have access to this transfer.")
  return delay(withLinks(db, transfer))
}

export interface TransferRequestInput {
  fromBranchId: string
  toBranchId: string
  note?: string
  lines: { variantId: string; quantity: number }[]
}

/** A request moves nothing: stock is reserved only when the sender approves. */
export async function createTransfer(input: TransferRequestInput, idempotencyKey?: string): Promise<TransferWithLinks> {
  const db = readDb()
  const replay = replayOf<TransferWithLinks>(db, idempotencyKey)
  if (replay) return delay(replay)

  if (input.fromBranchId === input.toBranchId) return delayedFailure('Pick two different locations.')
  const denied =
    permissionError('transfers:request', input.fromBranchId, db) &&
    permissionError('transfers:request', input.toBranchId, db)
  if (denied) return delayedFailure(denied)
  if (input.lines.length === 0) return delayedFailure('Add at least one variant.')

  const lines: Transfer['lines'] = []
  for (const { variantId, quantity } of input.lines) {
    const variant = db.variants.find((candidate) => candidate.id === variantId)
    const product = variant && db.products.find((candidate) => candidate.id === variant.productId)
    if (!variant || !product) return delayedFailure('One of the variants no longer exists.')
    if (product.archived) return delayedFailure(`${product.name} is archived and cannot be transferred.`)
    if (variant.archived) return delayedFailure(`${variant.sku} is inactive and cannot be transferred.`)
    if (lines.some((line) => line.variantId === variantId)) return delayedFailure(`${variant.sku} is listed twice.`)
    const available = availableOf(levelOf(db, variantId, input.fromBranchId))
    if (quantity > available) return delayedFailure(`Only ${available} of ${variant.sku} available at the sender.`)
    lines.push({
      variantId,
      sku: variant.sku,
      productName: product.name,
      size: variant.size,
      color: variant.color,
      requested: quantity,
      approved: 0,
      dispatched: 0,
      received: 0,
      damaged: 0,
      missing: 0,
    })
  }

  const now = new Date().toISOString()
  const transfer: Transfer = {
    id: createId('tr'),
    number: `TR-${String(db.transferSeq).padStart(4, '0')}`,
    fromBranchId: input.fromBranchId,
    toBranchId: input.toBranchId,
    status: 'requested',
    lines,
    events: [],
    invoiceIds: [],
    note: input.note?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  }
  const units = lines.reduce((sum, line) => sum + line.requested, 0)
  logEvent(transfer, `Requested ${units} ${units === 1 ? 'unit' : 'units'}`, now)
  db.transferSeq += 1
  db.transfers.push(transfer)
  const result = remember(db, idempotencyKey, withLinks(db, transfer))
  commitDb(db)
  return delay(result)
}

/** Before anything is dispatched only: reserved units go back to available. */
export function cancelTransfer(transferId: string, reason: string, idempotencyKey?: string) {
  return runTransferAction({
    transferId,
    idempotencyKey,
    action: 'transfers:approve',
    side: 'from',
    change: (db, transfer) => {
      if (!canCancelTransfer(transfer)) return 'Units have already been dispatched, so this transfer can no longer be cancelled.'
      if (reason.trim().length < 3) return 'Say why the transfer is cancelled.'
      for (const line of transfer.lines) {
        const reserved = lineStillReserved(line)
        if (reserved === 0) continue
        ensureLevel(db, line.variantId, transfer.fromBranchId).reserved -= reserved
        logMovement(db, { variantId: line.variantId, branchId: transfer.fromBranchId, kind: 'release', quantity: reserved, reference: transfer.number, refId: transfer.id })
      }
      transfer.status = 'cancelled'
      logEvent(transfer, `Cancelled: ${reason.trim()}`)
    },
  })
}
