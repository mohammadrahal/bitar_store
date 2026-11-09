import { getApiClient } from '@/lib/api'
import { priceOf } from '@/lib/api/map-catalog'
import type { ApiInvoice, ApiInvoiceLine, ApiInvoiceSummary, ListInvoicesParams } from '@/lib/api/types'

/**
 * Invoices the server holds, from `GET /invoices`.
 *
 * These are the server's: a **b2b** supply invoice priced off a transfer that
 * left the warehouse, or a **b2c** invoice for a till sale.
 *
 * Draft B2B supply invoices are edited and finalized on the invoice detail screen.
 */
export async function listInvoices(params: ListInvoicesParams = {}) {
  return getApiClient().listInvoicesPage({ limit: 20, ...params })
}

export async function getInvoice(id: string): Promise<ApiInvoice> {
  return getApiClient().getInvoice(id)
}

/**
 * The live supply invoice of a transfer.
 *
 * `GET /invoices?transferId=` answers with exactly that invoice (9 Nov), so
 * this no longer lists the whole b2b ledger and matches on the reference. The
 * old way missed an invoice whose transfer reference had been re-issued and
 * paged past one more than 50 rows old.
 *
 * Voided invoices are left out: a transfer whose only invoice was voided reads
 * as having none, which is what the screen should offer to fix.
 *
 * Prefer `transfer.supplyInvoice` from `GET /transfers/:id` when the transfer is
 * already loaded. this costs a request where that costs nothing.
 */
export async function findSupplyInvoiceForTransfer(transferId: string) {
  const { items } = await listInvoices({ transferId, limit: 1 })
  return items[0] ?? null
}

/** B2C fiscal invoice for a till sale, when the branch issued one. */
export async function findB2cInvoiceForSale(saleId: string) {
  const { items } = await listInvoices({ saleId, limit: 1 })
  return items[0] ?? null
}

/**
 * A supply invoice line priced at `missing` has no known cost, so it is priced
 * `0.00` and `POST /invoices/:id/finalize` answers **409** while one is left.
 * The price is set with `updateInvoicePrices`, which makes the line `manual`.
 */
export function linesMissingPrice(invoice: ApiInvoice): ApiInvoice['lines'] {
  return invoice.lines.filter((line) => line.priceSource === 'missing')
}

export function canFinalizeInvoice(invoice: ApiInvoice): boolean {
  return invoice.status === 'draft' && linesMissingPrice(invoice).length === 0
}

/** What a price on a line came from, in the words a screen shows. */
export function priceSourceLabel(source: ApiInvoiceLine['priceSource']): string | null {
  switch (source) {
    case 'cost':
      return 'Average purchase cost'
    case 'manual':
      return 'Entered by hand'
    case 'missing':
      return 'No cost known'
    case 'sale':
      return 'Price on the sale'
    default:
      return null
  }
}

export async function createSupplyInvoice(transferId: string, note?: string) {
  return getApiClient().createInvoice({ transferId, ...(note?.trim() ? { note: note.trim() } : {}) })
}

export async function finalizeInvoice(id: string) {
  return getApiClient().finalizeInvoice(id)
}

export async function voidInvoice(id: string, reason: string) {
  return getApiClient().voidInvoice(id, reason)
}

export async function updateInvoicePrices(
  id: string,
  input: { lines?: { skuId: string; unitPrice: string | number }[]; note?: string },
) {
  return getApiClient().updateInvoicePrices(id, input)
}

/** Final B2C invoice for a completed till sale (`POST /invoices` with `saleId`). */
export async function createB2cInvoiceForSale(
  saleId: string,
  customer?: { name?: string; phone?: string; note?: string },
): Promise<ApiInvoice> {
  return getApiClient().createInvoice({
    saleId,
    customerName: customer?.name?.trim() || undefined,
    customerPhone: customer?.phone?.trim() || undefined,
    note: customer?.note?.trim() || undefined,
  })
}

export function invoiceTotal(invoice: ApiInvoiceSummary): number {
  return priceOf(invoice.total)
}

/**
 * What to call an invoice with no number yet.
 *
 * A b2b invoice starts as a draft and `reference` is `null` until it is
 * finalized, so a row has to say "Draft" rather than print an empty cell that
 * reads as missing data.
 */
export function invoiceLabel(invoice: ApiInvoiceSummary): string {
  return invoice.reference ?? 'Draft'
}

export type { ApiInvoice, ApiInvoiceLine, ApiInvoiceSummary }
