import type { ApiInvoiceSummary } from '@/lib/api/types'
import { invoiceTotal } from '@/services/invoices-api.service'

export type LedgerTab = 'all' | 'paid' | 'pending' | 'drafts' | 'void'

export type LedgerDisplayStatus = 'paid' | 'pending' | 'draft' | 'void'

export function ledgerRangeIso(days: number) {
  const to = new Date()
  const from = new Date(Date.now() - days * 86_400_000)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

export function ledgerDisplayStatus(inv: ApiInvoiceSummary): LedgerDisplayStatus {
  if (inv.voided) return 'void'
  if (inv.status === 'draft') return inv.kind === 'b2b' ? 'pending' : 'draft'
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
