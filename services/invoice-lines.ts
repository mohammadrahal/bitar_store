import { createId } from '@/lib/ids'
import { pricedAtCost } from '@/lib/invoices'
import type { MockDb } from '@/mocks/store'
import type { InvoiceKind, InvoiceLine } from '@/types'

export interface InvoiceLineInput {
  id?: string
  variantId: string
  quantity: number
  unitPrice: number
}

/**
 * Builds stored lines from form input, or returns the reason it cannot. Each
 * line keeps a snapshot of the catalog, because the product may be renamed,
 * repriced or deleted long after the document is filed.
 */
export function normalizeLines(
  db: MockDb,
  kind: InvoiceKind,
  invoiceId: string,
  inputs: InvoiceLineInput[],
): InvoiceLine[] | string {
  const atCost = pricedAtCost(kind)
  const lines: InvoiceLine[] = []

  for (const incoming of inputs) {
    const variant = db.variants.find((candidate) => candidate.id === incoming.variantId)
    const product = variant && db.products.find((candidate) => candidate.id === variant.productId)
    if (!variant || !product) return 'One of the lines points at a variant that no longer exists.'

    lines.push({
      id: incoming.id ?? createId('il'),
      invoiceId,
      variantId: variant.id,
      sku: variant.sku,
      productName: product.name,
      size: variant.size,
      color: variant.color,
      quantity: incoming.quantity,
      unitPrice: incoming.unitPrice,
      // On a purchase the price paid *is* the cost; a sale carries today's cost.
      unitCost: atCost ? incoming.unitPrice : product.costPrice,
    })
  }

  return lines
}

/** One variant per document, so a quantity is never split across two lines. */
export function findDuplicateLine(lines: InvoiceLine[]) {
  const seen = new Set<string>()
  for (const line of lines) {
    if (seen.has(line.variantId)) return line
    seen.add(line.variantId)
  }
  return null
}

export function linesOf(db: MockDb, invoiceId: string) {
  return db.invoiceLines.filter((line) => line.invoiceId === invoiceId)
}
