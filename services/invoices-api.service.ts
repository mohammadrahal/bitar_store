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

/** Positive unit price from the form, or null when blank / zero / invalid. */
export function draftUnitPrice(prices: Record<string, string>, line: ApiInvoice['lines'][number]): string | null {
  const raw = (prices[line.sku.id] ?? line.unitPrice).trim()
  if (!raw) return null
  const n = Number.parseFloat(raw.replace(/,/g, ''))
  if (!Number.isFinite(n) || n <= 0) return null
  return raw.replace(/,/g, '')
}

/**
 * Lines still treated as unpriced for finalize: server `missing`, unless the
 * draft in the form is a positive price (even before Save draft).
 */
export function linesMissingPriceWithDraft(
  invoice: ApiInvoice,
  prices: Record<string, string>,
): ApiInvoice['lines'] {
  return invoice.lines.filter((line) => {
    if (line.priceSource !== 'missing') return false
    return draftUnitPrice(prices, line) === null
  })
}

export function patchPayloadForMissingLines(
  invoice: ApiInvoice,
  prices: Record<string, string>,
): { skuId: string; unitPrice: string }[] {
  return invoice.lines
    .map((line) => {
      if (line.priceSource !== 'missing') return null
      const unitPrice = draftUnitPrice(prices, line)
      return unitPrice ? { skuId: line.sku.id, unitPrice } : null
    })
    .filter(Boolean) as { skuId: string; unitPrice: string }[]
}

/**
 * Draft lines that are **not** priced at unit cost, with the cost they should
 * carry.
 *
 * A supply invoice charges a branch what the pieces cost, never the shop's
 * selling price. The server prices a new draft that way (`priceSource:
 * 'cost'`), so those lines are left alone even when the warehouse average has
 * moved since. What is caught here is the rest: a price typed by hand, a line
 * with no cost at the time, and an invoice raised before `priceSource` existed,
 * whose price may be the selling price. A line whose cost is still unknown
 * cannot be compared and is left out.
 */
export function linesOffUnitCost(
  invoice: ApiInvoice,
  prices: Record<string, string>,
  unitCosts: Record<string, number>,
): { line: ApiInvoiceLine; unitCost: string }[] {
  return invoice.lines.flatMap((line) => {
    const cost = unitCosts[line.sku.id]
    if (cost === undefined) return []
    const edited = prices[line.sku.id] !== undefined && prices[line.sku.id].trim() !== line.unitPrice.trim()
    if (line.priceSource === 'cost' && !edited) return []
    const unitCost = cost.toFixed(2)
    if (Number(unitCost) <= 0) return []
    const current = Number.parseFloat((prices[line.sku.id] ?? line.unitPrice).replace(/,/g, ''))
    if (Number.isFinite(current) && current.toFixed(2) === unitCost) return []
    return [{ line, unitCost }]
  })
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

/** Supply and return invoices come off a transfer, start as drafts and are priced at cost. */
export function isTransferInvoice(invoice: Pick<ApiInvoiceSummary, 'kind'>): boolean {
  return invoice.kind === 'b2b' || invoice.kind === 'b2b_return'
}

export function invoiceKindLabel(invoice: Pick<ApiInvoiceSummary, 'kind'>): string {
  if (invoice.kind === 'b2b_return') return 'Return invoice'
  if (invoice.kind === 'b2b') return 'Supply invoice'
  return 'Retail invoice'
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
