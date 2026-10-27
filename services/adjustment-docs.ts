import { createId } from '@/lib/ids'
import { nextInvoiceNumber, seriesFor } from '@/lib/invoice-number'
import type { MockDb } from '@/mocks/store'
import { ensureLevel } from '@/services/mock-ledger'
import type { Invoice } from '@/types'

export interface AdjustmentItem {
  variantId: string
  /** Signed: positive brings units in, negative takes them out. */
  delta: number
}

/**
 * Posts corrections as adjustment documents valued at cost, one per
 * direction, and moves on hand by the same amount. Every correction is on
 * paper with its reason, like any other stock movement.
 */
export function postAdjustments(db: MockDb, branchId: string, reason: string, items: AdjustmentItem[]): Invoice[] {
  const now = new Date().toISOString()
  const posted: Invoice[] = []
  for (const kind of ['adjustment_in', 'adjustment_out'] as const) {
    const chosen = items.filter((item) => (kind === 'adjustment_in' ? item.delta > 0 : item.delta < 0))
    if (chosen.length === 0) continue
    const invoice: Invoice = {
      id: createId('inv'),
      number: nextInvoiceNumber(seriesFor(kind, false), new Date(now), db.invoices.map((candidate) => candidate.number)),
      kind,
      branchId,
      partyName: '',
      reason,
      status: 'issued',
      issuedAt: now,
      discount: 0,
      isInternal: false,
      createdAt: now,
    }
    db.invoices.push(invoice)
    for (const item of chosen) {
      const variant = db.variants.find((candidate) => candidate.id === item.variantId)
      const product = variant && db.products.find((candidate) => candidate.id === variant.productId)
      if (!variant || !product) continue
      const quantity = Math.abs(item.delta)
      db.invoiceLines.push({
        id: createId('il'),
        invoiceId: invoice.id,
        variantId: variant.id,
        sku: variant.sku,
        productName: product.name,
        size: variant.size,
        color: variant.color,
        quantity,
        unitPrice: product.costPrice,
        unitCost: product.costPrice,
      })
      ensureLevel(db, variant.id, branchId).quantity += item.delta
    }
    posted.push({ ...invoice })
  }
  return posted
}
