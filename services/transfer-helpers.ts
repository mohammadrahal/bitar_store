import { delay, delayedFailure } from '@/lib/delay'
import { createId } from '@/lib/ids'
import { can, canAccessLocation, type Permission } from '@/lib/permissions'
import { transferTotals } from '@/lib/transfers'
import { commitDb, readDb, type MockDb } from '@/mocks/store'
import { actorName, branchNameOf, remember, replayOf } from '@/services/mock-ledger'
import { useUserStore } from '@/store/user-store'
import type { Transfer, TransferRow, TransferStatus, TransferWithLinks } from '@/types'

export function toRow(db: MockDb, transfer: Transfer): TransferRow {
  return {
    ...transfer,
    fromName: branchNameOf(db, transfer.fromBranchId),
    toName: branchNameOf(db, transfer.toBranchId),
    totals: transferTotals(transfer),
  }
}

export function withLinks(db: MockDb, transfer: Transfer): TransferWithLinks {
  const linkedInvoices = transfer.invoiceIds.flatMap((id) => {
    const invoice = db.invoices.find((candidate) => candidate.id === id)
    if (!invoice) return []
    const label =
      invoice.kind === 'purchase_return'
        ? `Return from ${branchNameOf(db, invoice.branchId)}`
        : `Sale to ${invoice.partyName}`
    return [{ id: invoice.id, number: invoice.number, label }]
  })
  return { ...toRow(db, transfer), linkedInvoices }
}

/** Where a transfer stands, worked out from its quantities rather than set by hand. */
export function deriveStatus(transfer: Transfer): TransferStatus {
  if (transfer.status === 'cancelled') return 'cancelled'
  const totals = transferTotals({ ...transfer, status: 'approved' })
  if (totals.dispatched === 0) return totals.approved > 0 ? 'approved' : 'requested'
  if (totals.inTransit === 0 && totals.stillReserved === 0) return 'closed'
  if (totals.received + totals.damaged + totals.missing > 0) return 'partly_received'
  return 'dispatched'
}

export function logEvent(transfer: Transfer, message: string, at = new Date().toISOString()) {
  transfer.events.unshift({ id: createId('ev'), at, actor: actorName(), message })
  transfer.updatedAt = at
}

/** The user must hold the key at that location and belong to that side of the transfer. */
export function permissionError(permission: Permission, branchId: string, db: MockDb): string | null {
  const user = useUserStore.getState().user
  if (!user || !can(user, permission, branchId)) return "You don't have access to this."
  if (!canAccessLocation(user, branchId)) return `Only staff at ${branchNameOf(db, branchId)} can do this.`
  return null
}

export function canSeeTransfer(transfer: Transfer): boolean {
  const user = useUserStore.getState().user
  if (!user) return false
  return canAccessLocation(user, transfer.fromBranchId) || canAccessLocation(user, transfer.toBranchId)
}

interface ActionSpec {
  transferId: string
  idempotencyKey?: string
  permission: Permission
  side: 'from' | 'to'
  /** Changes the working copy, or returns why it cannot. */
  change: (db: MockDb, transfer: Transfer) => string | void
}

/**
 * Runs one transfer action against a working copy of the store and commits
 * it only when every check passed. A repeated Idempotency-Key replays the
 * first answer instead of moving stock again.
 */
export async function runTransferAction({ transferId, idempotencyKey, permission, side, change }: ActionSpec) {
  const db = readDb()
  const replay = replayOf<TransferWithLinks>(db, idempotencyKey)
  if (replay) return delay(replay)

  const transfer = db.transfers.find((candidate) => candidate.id === transferId)
  if (!transfer) return delayedFailure('This transfer no longer exists.')
  const denied = permissionError(permission, side === 'from' ? transfer.fromBranchId : transfer.toBranchId, db)
  if (denied) return delayedFailure(denied)

  const refused = change(db, transfer)
  if (refused) return delayedFailure(refused)
  transfer.status = deriveStatus(transfer)
  const result = remember(db, idempotencyKey, withLinks(db, transfer))
  commitDb(db)
  return delay(result)
}
