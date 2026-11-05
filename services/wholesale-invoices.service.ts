import type { PaymentDraft } from '@/lib/sale-payments'
import { readPersistentJson, writePersistentJson } from '@/lib/session-storage'

export interface WholesaleInvoiceLine {
  skuId: string
  label: string
  quantity: number
  unitPrice: number
}

export type WholesaleInvoiceStatus = 'draft' | 'issued'

/** B2B wholesale document — local until the wholesale API ships (does not post a till sale). */
export interface WholesaleInvoice {
  id: string
  branchId: string
  customerName: string
  note: string
  status: WholesaleInvoiceStatus
  createdAt: string
  issuedAt?: string
  lines: WholesaleInvoiceLine[]
  /** Cash / Whish / split — same shape as the till (BL-04). */
  payment?: PaymentDraft
}

const STORAGE_KEY = 'bitar:wholesale-invoices:v1'

function readAll(): WholesaleInvoice[] {
  return readPersistentJson<WholesaleInvoice[]>(STORAGE_KEY, [])
}

function writeAll(invoices: WholesaleInvoice[]) {
  writePersistentJson(STORAGE_KEY, invoices)
}

export function listWholesaleInvoices(branchId?: string, status?: WholesaleInvoiceStatus): WholesaleInvoice[] {
  let rows = readAll().sort((a, b) => (b.issuedAt ?? b.createdAt).localeCompare(a.issuedAt ?? a.createdAt))
  if (branchId) rows = rows.filter((row) => row.branchId === branchId)
  if (status) rows = rows.filter((row) => row.status === status)
  return rows
}

export function getWholesaleInvoice(id: string): WholesaleInvoice | undefined {
  return readAll().find((row) => row.id === id)
}

export function saveWholesaleInvoice(
  input: Omit<WholesaleInvoice, 'id' | 'createdAt' | 'issuedAt'> & { id?: string; issuedAt?: string },
): WholesaleInvoice {
  const all = readAll()
  const createdAt = new Date().toISOString()
  const existing = input.id ? all.find((row) => row.id === input.id) : undefined
  const invoice: WholesaleInvoice = {
    id: input.id ?? crypto.randomUUID(),
    branchId: input.branchId,
    customerName: input.customerName.trim(),
    note: input.note,
    status: input.status,
    createdAt: existing?.createdAt ?? createdAt,
    issuedAt: input.status === 'issued' ? (input.issuedAt ?? new Date().toISOString()) : undefined,
    lines: input.lines,
    payment: input.payment,
  }
  const next = all.filter((row) => row.id !== invoice.id)
  next.unshift(invoice)
  writeAll(next)
  return invoice
}

export function deleteWholesaleInvoice(id: string): void {
  writeAll(readAll().filter((row) => row.id !== id))
}

export function wholesaleInvoiceTotal(invoice: WholesaleInvoice): number {
  return invoice.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
}

export function wholesaleReference(invoice: WholesaleInvoice): string {
  const tag = invoice.status === 'issued' ? 'INV' : 'DRAFT'
  return `${tag}-${invoice.id.slice(0, 8).toUpperCase()}`
}
