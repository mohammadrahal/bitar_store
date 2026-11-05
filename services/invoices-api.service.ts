import { getApiClient } from '@/lib/api'
import { priceOf } from '@/lib/api/map-catalog'
import type { ApiInvoice, ApiInvoiceSummary, ListInvoicesParams } from '@/lib/api/types'

/**
 * Invoices the server holds, from `GET /invoices`.
 *
 * Read-only for now, and deliberately separate from
 * `wholesale-invoices.service.ts`, which still keeps its own documents in this
 * browser. These are the server's: a **b2b** supply invoice priced off a
 * transfer that left the warehouse, or a **b2c** invoice for a till sale.
 *
 * `POST`, `PATCH`, `/finalize`, `/void` and `/pdf` all exist on the client
 * (`lib/api/invoices.api.ts`) and are not wired to any screen yet.
 */
export async function listInvoices(params: ListInvoicesParams = {}) {
  return getApiClient().listInvoicesPage({ limit: 20, ...params })
}

export async function getInvoice(id: string): Promise<ApiInvoice> {
  return getApiClient().getInvoice(id)
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

export type { ApiInvoice, ApiInvoiceSummary }
