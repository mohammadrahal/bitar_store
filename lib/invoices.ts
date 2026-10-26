import type { Invoice, InvoiceKind, InvoiceStatus, SalesChannel } from '@/types'

export const INVOICE_KINDS = [
  'sale',
  'purchase',
  'sale_return',
  'purchase_return',
  'adjustment_in',
  'adjustment_out',
] as const

export const INVOICE_KIND_LABELS: Record<InvoiceKind, string> = {
  sale: 'Sale',
  purchase: 'Purchase',
  sale_return: 'Sale return',
  purchase_return: 'Purchase return',
  adjustment_in: 'Adjustment in',
  adjustment_out: 'Adjustment out',
}

/** What the other side of the document is called, which the form label follows. */
export const PARTY_LABELS: Record<InvoiceKind, string> = {
  sale: 'Customer',
  purchase: 'Supplier',
  sale_return: 'Customer',
  purchase_return: 'Supplier',
  /* An adjustment has no counterparty, so the field carries why instead. */
  adjustment_in: 'Reason',
  adjustment_out: 'Reason',
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  issued: 'Issued',
  paid: 'Paid',
  void: 'Void',
}

/** How one unit on this kind of document moves the document branch's stock. */
export function stockSign(kind: InvoiceKind): 1 | -1 {
  return kind === 'purchase' || kind === 'sale_return' || kind === 'adjustment_in' ? 1 : -1
}

/**
 * Sales are priced at sell, anything touching supply or valuing a correction
 * at cost. This also gates the kind picker: only a user with
 * `purchases:manage` may raise one, which keeps write-offs away from the till.
 */
export function pricedAtCost(kind: InvoiceKind) {
  return kind !== 'sale' && kind !== 'sale_return'
}

export function isAdjustmentKind(kind: InvoiceKind) {
  return kind === 'adjustment_in' || kind === 'adjustment_out'
}

/**
 * What a document names on its other side: a party for trade, the reason for a
 * correction. The partyName fallback keeps any row written before `reason`
 * existed readable.
 */
export function documentSubject(invoice: Invoice): string {
  if (!isAdjustmentKind(invoice.kind)) return invoice.partyName
  return invoice.reason || invoice.partyName || 'Stock correction'
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
