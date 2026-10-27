import { createId } from '@/lib/ids'
import { nextInvoiceNumber, seriesFor } from '@/lib/invoice-number'
import type { MockDb } from '@/mocks/store'
import type { Invoice, InvoiceKind, InvoiceLine, Transfer } from '@/types'

interface Leg {
  kind: InvoiceKind
  branchId: string
  counterpartyBranchId?: string
  partyName: string
}

function nameOf(db: MockDb, branchId: string) {
  return db.branches.find((branch) => branch.id === branchId)?.name ?? 'Unknown location'
}

/**
 * Stock between locations is booked through the warehouse: a branch sending
 * stock returns it to the warehouse, and the warehouse sells it on to the
 * receiver. Warehouse-to-branch needs only the sale leg; branch-to-warehouse
 * only the return.
 */
function legsFor(db: MockDb, transfer: Transfer): Leg[] {
  const warehouse = db.warehouseId
  const { fromBranchId: from, toBranchId: to } = transfer
  if (!warehouse) {
    return [{ kind: 'sale', branchId: from, counterpartyBranchId: to, partyName: nameOf(db, to) }]
  }
  const legs: Leg[] = []
  if (from !== warehouse) {
    legs.push({ kind: 'purchase_return', branchId: from, counterpartyBranchId: warehouse, partyName: nameOf(db, warehouse) })
  }
  if (to !== warehouse) {
    legs.push({ kind: 'sale', branchId: warehouse, counterpartyBranchId: to, partyName: nameOf(db, to) })
  }
  return legs
}

/**
 * Documents for units that just left the sender, priced at cost because no
 * margin is earned inside the business. They carry the transfer id, so the
 * ledger never moves their stock a second time.
 */
export function buildTransferInvoices(
  db: MockDb,
  transfer: Transfer,
  quantities: Map<string, number>,
  at: string,
): { invoices: Invoice[]; lines: InvoiceLine[] } {
  const invoices: Invoice[] = []
  const lines: InvoiceLine[] = []
  const numbers = db.invoices.map((invoice) => invoice.number)

  for (const leg of legsFor(db, transfer)) {
    const id = createId('inv')
    const number = nextInvoiceNumber(seriesFor(leg.kind, true), new Date(at), numbers)
    numbers.push(number)
    invoices.push({
      id,
      number,
      kind: leg.kind,
      branchId: leg.branchId,
      partyName: leg.partyName,
      status: 'issued',
      issuedAt: at,
      discount: 0,
      notes: `Raised by ${transfer.number}`,
      isInternal: true,
      counterpartyBranchId: leg.counterpartyBranchId,
      transferId: transfer.id,
      createdAt: at,
    })
    for (const line of transfer.lines) {
      const quantity = quantities.get(line.variantId) ?? 0
      if (quantity === 0) continue
      const variant = db.variants.find((candidate) => candidate.id === line.variantId)
      const product = variant && db.products.find((candidate) => candidate.id === variant.productId)
      const cost = product?.costPrice ?? 0
      lines.push({
        id: createId('il'),
        invoiceId: id,
        variantId: line.variantId,
        sku: line.sku,
        productName: line.productName,
        size: line.size,
        color: line.color,
        quantity,
        unitPrice: cost,
        unitCost: cost,
      })
    }
  }
  return { invoices, lines }
}
