import { createId } from '@/lib/ids'
import { lineInTransit, lineStillReserved } from '@/lib/transfers'
import { actorName, availableOf, ensureLevel, levelOf, logMovement } from '@/services/mock-ledger'
import { logEvent, runTransferAction } from '@/services/transfer-helpers'
import { buildTransferInvoices } from '@/services/transfer-invoices'

export type LineQuantities = Record<string, number>

const plural = (count: number) => `${count} ${count === 1 ? 'unit' : 'units'}`

/** Approving reserves the units at the sender, so nothing else can sell or send them. */
export function approveTransfer(transferId: string, quantities: LineQuantities, idempotencyKey?: string) {
  return runTransferAction({
    transferId,
    idempotencyKey,
    action: 'transfers:approve',
    side: 'from',
    change: (db, transfer) => {
      if (transfer.status !== 'requested') return 'Only a requested transfer can be approved.'
      let total = 0
      for (const line of transfer.lines) {
        const quantity = quantities[line.variantId] ?? 0
        if (!Number.isInteger(quantity) || quantity < 0) return 'Quantities must be whole units.'
        if (quantity > line.requested) return `${line.sku}: approve at most the ${line.requested} requested.`
        const available = availableOf(levelOf(db, line.variantId, transfer.fromBranchId))
        if (quantity > available) return `${line.sku}: only ${available} available at the sender.`
        total += quantity
      }
      if (total === 0) return 'Approve at least one unit, or cancel the transfer instead.'
      for (const line of transfer.lines) {
        line.approved = quantities[line.variantId] ?? 0
        if (line.approved === 0) continue
        ensureLevel(db, line.variantId, transfer.fromBranchId).reserved += line.approved
        logMovement(db, { variantId: line.variantId, branchId: transfer.fromBranchId, kind: 'reserve', quantity: line.approved, reference: transfer.number, refId: transfer.id })
      }
      const requested = transfer.lines.reduce((sum, line) => sum + line.requested, 0)
      logEvent(transfer, total < requested ? `Approved ${total} of ${requested}, reserved at the sender` : `Approved ${total}, reserved at the sender`)
    },
  })
}

/** Units leave the sender's shelf and its reservation, and the two transfer documents are raised. */
export function dispatchTransfer(transferId: string, quantities: LineQuantities, idempotencyKey?: string) {
  return runTransferAction({
    transferId,
    idempotencyKey,
    action: 'transfers:dispatch',
    side: 'from',
    change: (db, transfer) => {
      if (transfer.status === 'requested' || transfer.status === 'cancelled' || transfer.status === 'closed') {
        return 'Only an approved transfer can be dispatched.'
      }
      const moved = new Map<string, number>()
      for (const line of transfer.lines) {
        const quantity = quantities[line.variantId] ?? 0
        if (!Number.isInteger(quantity) || quantity < 0) return 'Quantities must be whole units.'
        const reserved = lineStillReserved(line)
        if (quantity > reserved) return `${line.sku}: only ${reserved} approved and not yet dispatched.`
        if (quantity > 0) moved.set(line.variantId, quantity)
      }
      if (moved.size === 0) return 'Dispatch at least one unit.'

      const now = new Date().toISOString()
      for (const line of transfer.lines) {
        const quantity = moved.get(line.variantId) ?? 0
        if (quantity === 0) continue
        const level = ensureLevel(db, line.variantId, transfer.fromBranchId)
        level.quantity -= quantity
        level.reserved -= quantity
        line.dispatched += quantity
        logMovement(db, { variantId: line.variantId, branchId: transfer.fromBranchId, kind: 'transfer_out', quantity: -quantity, reference: transfer.number, refId: transfer.id, at: now })
      }
      const { invoices, lines } = buildTransferInvoices(db, transfer, moved, now)
      db.invoices.push(...invoices)
      db.invoiceLines.push(...lines)
      transfer.invoiceIds.push(...invoices.map((invoice) => invoice.id))

      const sent = [...moved.values()].reduce((sum, value) => sum + value, 0)
      const approved = transfer.lines.reduce((sum, line) => sum + line.approved, 0)
      const dispatched = transfer.lines.reduce((sum, line) => sum + line.dispatched, 0)
      const left = approved - dispatched
      logEvent(transfer, left > 0 ? `Dispatched ${sent} (${dispatched} of ${approved}). ${left} still reserved` : `Dispatched ${plural(sent)}`, now)
    },
  })
}

export interface ReceiptLine {
  accepted: number
  damaged: number
}

/** Accepted units become sellable at the receiver; damaged or wrong ones arrive on hold there. */
export function receiveTransfer(
  transferId: string,
  receipt: Record<string, ReceiptLine>,
  reason: string,
  idempotencyKey?: string,
) {
  return runTransferAction({
    transferId,
    idempotencyKey,
    action: 'transfers:receive',
    side: 'to',
    change: (db, transfer) => {
      let accepted = 0
      let damaged = 0
      for (const line of transfer.lines) {
        const entry = receipt[line.variantId] ?? { accepted: 0, damaged: 0 }
        if (![entry.accepted, entry.damaged].every((value) => Number.isInteger(value) && value >= 0)) {
          return 'Quantities must be whole units.'
        }
        const transit = lineInTransit(line)
        if (entry.accepted + entry.damaged > transit) return `${line.sku}: only ${transit} in transit.`
        accepted += entry.accepted
        damaged += entry.damaged
      }
      if (accepted + damaged === 0) return 'Enter what arrived.'
      if (damaged > 0 && reason.trim().length < 3) return 'Say what was wrong with the damaged or wrong units.'

      const now = new Date().toISOString()
      for (const line of transfer.lines) {
        const entry = receipt[line.variantId]
        if (!entry || entry.accepted + entry.damaged === 0) continue
        const level = ensureLevel(db, line.variantId, transfer.toBranchId)
        level.quantity += entry.accepted + entry.damaged
        line.received += entry.accepted
        line.damaged += entry.damaged
        logMovement(db, { variantId: line.variantId, branchId: transfer.toBranchId, kind: 'transfer_in', quantity: entry.accepted + entry.damaged, reference: transfer.number, refId: transfer.id, at: now })
        if (entry.damaged === 0) continue
        level.onHold += entry.damaged
        const holdId = createId('hd')
        db.holds.push({ id: holdId, variantId: line.variantId, branchId: transfer.toBranchId, quantity: entry.damaged, reason: `${reason.trim()} (${transfer.number})`, source: 'receipt', transferId: transfer.id, createdAt: now, createdBy: actorName() })
        logMovement(db, { variantId: line.variantId, branchId: transfer.toBranchId, kind: 'hold', quantity: entry.damaged, reference: transfer.number, refId: transfer.id, note: reason.trim(), at: now })
      }
      logEvent(
        transfer,
        damaged > 0
          ? `Received ${accepted + damaged}: accepted ${accepted}, ${damaged} damaged or wrong put on hold`
          : `Received and accepted ${plural(accepted)}`,
        now,
      )
    },
  })
}

/** Gives back what was approved but will not be sent. */
export function releaseReserved(transferId: string, idempotencyKey?: string) {
  return runTransferAction({
    transferId,
    idempotencyKey,
    action: 'transfers:approve',
    side: 'from',
    change: (db, transfer) => {
      const total = transfer.lines.reduce((sum, line) => sum + lineStillReserved(line), 0)
      if (total === 0 || transfer.status === 'requested') return 'Nothing is reserved on this transfer.'
      for (const line of transfer.lines) {
        const reserved = lineStillReserved(line)
        if (reserved === 0) continue
        ensureLevel(db, line.variantId, transfer.fromBranchId).reserved -= reserved
        line.approved = line.dispatched
        logMovement(db, { variantId: line.variantId, branchId: transfer.fromBranchId, kind: 'release', quantity: reserved, reference: transfer.number, refId: transfer.id })
      }
      logEvent(transfer, `Released ${plural(total)} reserved at the sender`)
    },
  })
}

/**
 * Units that never arrived are written off as missing, so the transfer can
 * close. BL-02 has not defined what else a discrepancy can resolve to yet.
 */
export function reportDiscrepancy(transferId: string, note: string, idempotencyKey?: string) {
  return runTransferAction({
    transferId,
    idempotencyKey,
    action: 'transfers:receive',
    side: 'to',
    change: (_db, transfer) => {
      const missing = transfer.lines.reduce((sum, line) => sum + lineInTransit(line), 0)
      if (missing === 0) return 'Nothing is in transit on this transfer.'
      if (note.trim().length < 3) return 'Describe the discrepancy.'
      for (const line of transfer.lines) line.missing += lineInTransit(line)
      logEvent(transfer, `Reported ${plural(missing)} missing: ${note.trim()}`)
    },
  })
}