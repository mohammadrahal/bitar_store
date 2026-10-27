import { stockSign } from '@/lib/invoices'
import type { MockDb } from '@/mocks/store'
import { availableOf, branchNameOf, ensureLevel, levelOf } from '@/services/mock-ledger'
import type { Invoice, InvoiceLine } from '@/types'

/**
 * Every branch a line moves, and by how much. Documents raised by a transfer
 * move nothing here: the transfer itself already moved the stock.
 * `direction` is 1 when posting a document and -1 when voiding one.
 */
function movements(invoice: Invoice, line: InvoiceLine, direction: 1 | -1) {
  if (invoice.transferId) return []
  const quantity = stockSign(invoice.kind) * direction * line.quantity
  const moves = [{ branchId: invoice.branchId, quantity }]
  if (invoice.isInternal && invoice.counterpartyBranchId) {
    moves.push({ branchId: invoice.counterpartyBranchId, quantity: -quantity })
  }
  return moves
}

export interface Shortage {
  line: InvoiceLine
  branchName: string
  available: number
}

/**
 * The first line that would take more than is available: on hand less what is
 * reserved for transfers and what is on hold. Those units are not for sale.
 */
export function findShortage(
  db: MockDb,
  invoice: Invoice,
  lines: InvoiceLine[],
  direction: 1 | -1,
): Shortage | null {
  for (const line of lines) {
    for (const move of movements(invoice, line, direction)) {
      if (move.quantity >= 0) continue
      const available = availableOf(levelOf(db, line.variantId, move.branchId))
      if (available + move.quantity < 0) {
        return { line, branchName: branchNameOf(db, move.branchId), available }
      }
    }
  }
  return null
}

export function shortageMessage(shortage: Shortage) {
  return `Only ${shortage.available} of ${shortage.line.sku} available at ${shortage.branchName}, and this document needs ${shortage.line.quantity}.`
}

export function applyStock(db: MockDb, invoice: Invoice, lines: InvoiceLine[], direction: 1 | -1) {
  for (const line of lines) {
    for (const move of movements(invoice, line, direction)) {
      ensureLevel(db, line.variantId, move.branchId).quantity += move.quantity
    }
  }
}
