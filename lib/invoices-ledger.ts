import type { ApiInvoiceSummary } from '@/lib/api/types'
import { invoiceTotal, isTransferInvoice } from '@/services/invoices-api.service'

export type LedgerTab = 'all' | 'paid' | 'pending' | 'drafts' | 'void'

export type LedgerDisplayStatus = 'paid' | 'pending' | 'draft' | 'void'

/** `b2b` covers supply and return invoices: both are between the warehouse and a branch. */
export type LedgerKind = 'all' | 'b2c' | 'b2b'

export function matchesLedgerKind(inv: ApiInvoiceSummary, kind: LedgerKind): boolean {
  if (kind === 'all') return true
  return kind === 'b2b' ? isTransferInvoice(inv) : inv.kind === 'b2c'
}

/** The server reads `from`/`to` as calendar days in the shop's time zone, so send local days, not UTC ones. */
function localDay(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function ledgerRangeIso(days: number) {
  return { from: localDay(new Date(Date.now() - days * 86_400_000)), to: localDay(new Date()) }
}

export function ledgerDisplayStatus(inv: ApiInvoiceSummary): LedgerDisplayStatus {
  if (inv.voided) return 'void'
  if (inv.status === 'draft') return isTransferInvoice(inv) ? 'pending' : 'draft'
  return 'paid'
}

export function matchesLedgerTab(status: LedgerDisplayStatus, tab: LedgerTab): boolean {
  if (tab === 'all') return true
  if (tab === 'paid') return status === 'paid'
  if (tab === 'pending') return status === 'pending'
  if (tab === 'drafts') return status === 'draft' || status === 'pending'
  if (tab === 'void') return status === 'void'
  return true
}

export function ledgerStatusLabel(status: LedgerDisplayStatus): string {
  switch (status) {
    case 'paid':
      return 'Paid'
    case 'pending':
      return 'Pending clearance'
    case 'draft':
      return 'Draft'
    case 'void':
      return 'Voided'
  }
}

export interface LedgerKpis {
  count: number
  total: number
  paid: number
  paidCount: number
  pending: number
  pendingCount: number
  voided: number
  voidCount: number
  draftCount: number
}

export function computeApiLedgerKpis(invoices: ApiInvoiceSummary[]): LedgerKpis {
  let total = 0
  let paid = 0
  let pending = 0
  let voided = 0
  let paidCount = 0
  let pendingCount = 0
  let voidCount = 0
  let draftCount = 0

  for (const inv of invoices) {
    const amount = invoiceTotal(inv)
    const status = ledgerDisplayStatus(inv)
    total += amount
    if (status === 'paid') {
      paid += amount
      paidCount++
    } else if (status === 'pending') {
      pending += amount
      pendingCount++
    } else if (status === 'draft') {
      draftCount++
      pending += amount
    } else if (status === 'void') {
      voided += amount
      voidCount++
    }
  }

  return {
    count: invoices.length,
    total,
    paid,
    paidCount,
    pending,
    pendingCount,
    voided,
    voidCount,
    draftCount,
  }
}

export function matchesInvoiceSearch(inv: ApiInvoiceSummary, query: string) {
  const haystack = [
    inv.reference ?? '',
    inv.recipient.name ?? '',
    inv.recipient.phone ?? '',
    inv.sale?.reference ?? '',
    inv.transfer?.reference ?? '',
    inv.note ?? '',
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}
