import type { Transfer, TransferLine, TransferStatus, TransferTotals } from '@/types'

export const TRANSFER_STATUS_LABELS: Record<TransferStatus, string> = {
  requested: 'Requested',
  approved: 'Approved',
  dispatched: 'Dispatched',
  partly_received: 'Partly received',
  closed: 'Closed',
  cancelled: 'Cancelled',
}

export const TRANSFER_STATUSES: TransferStatus[] = [
  'requested',
  'approved',
  'dispatched',
  'partly_received',
  'closed',
  'cancelled',
]

/** Still needs someone to act: anything not closed or cancelled. */
export function isOpenTransfer(status: TransferStatus) {
  return status !== 'closed' && status !== 'cancelled'
}

export function lineInTransit(line: TransferLine) {
  return Math.max(0, line.dispatched - line.received - line.damaged - line.missing)
}

/** Approved but not yet dispatched, so still reserved at the sender. */
export function lineStillReserved(line: TransferLine) {
  return Math.max(0, line.approved - line.dispatched)
}

export function transferTotals(transfer: Pick<Transfer, 'lines' | 'status'>): TransferTotals {
  const totals: TransferTotals = {
    requested: 0,
    approved: 0,
    dispatched: 0,
    received: 0,
    damaged: 0,
    missing: 0,
    inTransit: 0,
    stillReserved: 0,
  }
  for (const line of transfer.lines) {
    totals.requested += line.requested
    totals.approved += line.approved
    totals.dispatched += line.dispatched
    totals.received += line.received
    totals.damaged += line.damaged
    totals.missing += line.missing
    totals.inTransit += lineInTransit(line)
    if (transfer.status !== 'cancelled' && transfer.status !== 'closed') totals.stillReserved += lineStillReserved(line)
  }
  return totals
}

/** Cancel is only possible while nothing has left the sender. */
export function canCancelTransfer(transfer: Pick<Transfer, 'status' | 'lines'>) {
  return (
    (transfer.status === 'requested' || transfer.status === 'approved') &&
    transfer.lines.every((line) => line.dispatched === 0)
  )
}
