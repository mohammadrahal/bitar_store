import { stockSign } from '@/lib/invoices'
import type { MockDb } from '@/mocks/store'
import type { Invoice, InvoiceLine } from '@/types'

const DEFAULT_LOW_STOCK_AT = 5

function branchName(db: MockDb, branchId: string) {
  return db.branches.find((candidate) => candidate.id === branchId)?.name ?? 'Unknown branch'
}

function adjust(db: MockDb, variantId: string, branchId: string, delta: number) {
  const level = db.stock.find((candidate) => candidate.variantId === variantId && candidate.branchId === branchId)
  if (level) {
    level.quantity += delta
    return
  }
  // A missing row counts as zero on hand, so only an inbound delta gets here.
  db.stock.push({ variantId, branchId, quantity: Math.max(delta, 0), lowStockAt: DEFAULT_LOW_STOCK_AT })
}

function onHand(db: MockDb, variantId: string, branchId: string) {
  return db.stock.find((level) => level.variantId === variantId && level.branchId === branchId)?.quantity ?? 0
}

/**
 * Every branch a line moves, and by how much. An internal transfer leg moves
 * both its own branch and the hub on the other side, in opposite directions.
 * `direction` is 1 when posting a document and -1 when voiding one.
 */
function movements(invoice: Invoice, line: InvoiceLine, direction: 1 | -1) {
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

/** The first line that would push a branch below zero, with the numbers to say so. */
export function findShortage(
  db: MockDb,
  invoice: Invoice,
  lines: InvoiceLine[],
  direction: 1 | -1,
): Shortage | null {
  for (const line of lines) {
    for (const move of movements(invoice, line, direction)) {
      if (move.quantity >= 0) continue
      const available = onHand(db, line.variantId, move.branchId)
      if (available + move.quantity < 0) {
        return { line, branchName: branchName(db, move.branchId), available }
      }
    }
  }
  return null
}

export function shortageMessage(shortage: Shortage) {
  return `${shortage.branchName} holds only ${shortage.available} of ${shortage.line.sku}, and this document needs ${shortage.line.quantity}.`
}

export function applyStock(db: MockDb, invoice: Invoice, lines: InvoiceLine[], direction: 1 | -1) {
  for (const line of lines) {
    for (const move of movements(invoice, line, direction)) {
      adjust(db, line.variantId, move.branchId, move.quantity)
    }
  }
}
