import type { Invoice, InvoiceKind, InvoiceStatus, SalesChannel } from '@/types'

export const INVOICE_KINDS = ['sale', 'purchase', 'sale_return', 'purchase_return'] as const

export const INVOICE_KIND_LABELS: Record<InvoiceKind, string> = {
  sale: 'Sale',
  purchase: 'Purchase',
  sale_return: 'Sale return',
  purchase_return: 'Purchase return',
}

/** What the other side of the document is called, which the form label follows. */
export const PARTY_LABELS: Record<InvoiceKind, string> = {
  sale: 'Customer',
  purchase: 'Supplier',
  sale_return: 'Customer',
  purchase_return: 'Supplier',
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  issued: 'Issued',
  paid: 'Paid',
  void: 'Void',
}

/** How one unit on this kind of document moves the document branch's stock. */
export function stockSign(kind: InvoiceKind): 1 | -1 {
  return kind === 'purchase' || kind === 'sale_return' ? 1 : -1
}

/** Sales are priced at sell, anything touching supply at cost. */
export function pricedAtCost(kind: InvoiceKind) {
  return kind === 'purchase' || kind === 'purchase_return'
}

export function isCustomerSaleKind(kind: InvoiceKind) {
  return kind === 'sale' || kind === 'sale_return'
}

/** Older rows may lack a channel; treat them as retail. */
export function salesChannelOf(invoice: Invoice): SalesChannel | undefined {
  if (!isCustomerSaleKind(invoice.kind)) return undefined
  return invoice.salesChannel ?? 'b2c'
}

/**
 * Only external sales and their returns are money the business earned. Internal
 * transfer legs move stock between branches and must never reach a revenue
 * figure, or one jacket moved twice would show up as three sales.
 */
export function isRevenueDocument(invoice: Invoice) {
  return !invoice.isInternal && (invoice.kind === 'sale' || invoice.kind === 'sale_return')
}

/** A revenue document's signed contribution: a return subtracts. */
export function revenueSign(kind: InvoiceKind): 1 | -1 {
  return kind === 'sale_return' ? -1 : 1
}

/** Posted documents have moved stock; drafts and voids have not. */
export function isPosted(invoice: Invoice) {
  return invoice.status === 'issued' || invoice.status === 'paid'
}

/** Drafts are the only documents still safe to rewrite or throw away. */
export function isEditable(invoice: Invoice) {
  return invoice.status === 'draft'
}

export const INVOICE_STATUSES = ['draft', 'issued', 'paid', 'void'] as const
