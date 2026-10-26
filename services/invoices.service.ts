import { delay, delayedFailure } from '@/lib/delay'
import { createId } from '@/lib/ids'
import { nextInvoiceNumber, seriesFor } from '@/lib/invoice-number'
import { invoiceTotals } from '@/lib/invoice-totals'
import { isAdjustmentKind, isCustomerSaleKind, isPosted, salesChannelOf } from '@/lib/invoices'
import type { InvoiceFilters } from '@/lib/query-keys'
import { readDb, writeDb, type MockDb } from '@/mocks/store'
import { findDuplicateLine, linesOf, normalizeLines, type InvoiceLineInput } from '@/services/invoice-lines'
import { applyStock, findShortage, shortageMessage } from '@/services/invoice-stock'
import {
  ALL_BRANCHES,
  type Invoice,
  type InvoiceKind,
  type InvoiceLine,
  type InvoiceRow,
  type InvoiceWithLines,
  type SalesChannel,
} from '@/types'

export type { InvoiceLineInput }

export interface InvoiceInput {
  kind: InvoiceKind
  branchId: string
  partyName: string
  /** Required on an adjustment, unused elsewhere. */
  reason?: string
  /** `yyyy-MM-dd` from the form; stored as an ISO timestamp. */
  issuedAt: string
  discount: number
  notes?: string
  salesChannel?: SalesChannel
  lines: InvoiceLineInput[]
}

function branchName(db: MockDb, branchId: string) {
  return db.branches.find((candidate) => candidate.id === branchId)?.name ?? 'Unknown branch'
}

function toRow(db: MockDb, invoice: Invoice, lines: InvoiceLine[], total: number): InvoiceRow {
  return {
    ...invoice,
    branchName: branchName(db, invoice.branchId),
    lineCount: lines.length,
    units: lines.reduce((sum, line) => sum + line.quantity, 0),
    total,
  }
}

/* ---------- Reads ---------- */

export async function listInvoices(filters: InvoiceFilters): Promise<InvoiceRow[]> {
  const db = readDb()
  const search = filters.search.trim().toLowerCase()

  const rows = db.invoices
    .filter((invoice) => filters.scope === ALL_BRANCHES || invoice.branchId === filters.scope)
    .filter((invoice) => filters.kind === 'all' || invoice.kind === filters.kind)
    .filter((invoice) => {
      if (!filters.salesChannel) return true
      if (!isCustomerSaleKind(invoice.kind)) return false
      return salesChannelOf(invoice) === filters.salesChannel
    })
    .filter((invoice) => filters.status === 'all' || invoice.status === filters.status)
    .filter((invoice) => {
      if (!search) return true
      return (
        invoice.number.toLowerCase().includes(search) ||
        invoice.partyName.toLowerCase().includes(search) ||
        (invoice.reason ?? '').toLowerCase().includes(search) ||
        linesOf(db, invoice.id).some(
          (line) => line.sku.toLowerCase().includes(search) || line.productName.toLowerCase().includes(search),
        )
      )
    })
    .map((invoice) => {
      const lines = linesOf(db, invoice.id)
      return toRow(db, invoice, lines, invoiceTotals(lines, invoice.discount).total)
    })
    // Newest first, with the number as a stable tiebreaker for same-day documents.
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt) || b.number.localeCompare(a.number))

  return delay(rows)
}

export async function getInvoice(id: string): Promise<InvoiceWithLines> {
  const db = readDb()
  const invoice = db.invoices.find((candidate) => candidate.id === id)
  if (!invoice) return delayedFailure(`Document "${id}" no longer exists.`)
  return delay({ ...invoice, lines: linesOf(db, id) })
}

/** Posted documents touching a product, newest first, for the catalog's history panel. */
export async function listInvoicesByProduct(productId: string): Promise<InvoiceRow[]> {
  const db = readDb()
  const variantIds = new Set(
    db.variants.filter((variant) => variant.productId === productId).map((variant) => variant.id),
  )

  const rows = db.invoices
    .filter(isPosted)
    .flatMap((invoice) => {
      const lines = linesOf(db, invoice.id).filter((line) => variantIds.has(line.variantId))
      if (lines.length === 0) return []
      // This product's share of the document, not the document total.
      return [toRow(db, invoice, lines, invoiceTotals(lines, 0).subtotal)]
    })
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))

  return delay(rows)
}

/* ---------- Writes ---------- */

function toIsoDate(value: string) {
  return new Date(`${value}T09:00:00.000Z`).toISOString()
}

export async function createInvoice(input: InvoiceInput, issue = false): Promise<InvoiceWithLines> {
  const db = readDb()
  if (!db.branches.some((candidate) => candidate.id === input.branchId)) {
    return delayedFailure(`Branch "${input.branchId}" no longer exists.`)
  }

  const id = createId('inv')
  const lines = normalizeLines(db, input.kind, id, input.lines)
  if (typeof lines === 'string') return delayedFailure(lines)
  const duplicate = findDuplicateLine(lines)
  if (duplicate) return delayedFailure(`${duplicate.sku} is listed on two lines. Combine them into one.`)

  const issuedAt = toIsoDate(input.issuedAt)
  const salesChannel = isCustomerSaleKind(input.kind) ? (input.salesChannel ?? 'b2c') : undefined
  const invoice: Invoice = {
    id,
    number: nextInvoiceNumber(
      seriesFor(input.kind, false),
      new Date(issuedAt),
      db.invoices.map((candidate) => candidate.number),
    ),
    kind: input.kind,
    branchId: input.branchId,
    /* A correction has no counterparty, so it stores why instead of who. */
    partyName: isAdjustmentKind(input.kind) ? '' : input.partyName.trim(),
    reason: isAdjustmentKind(input.kind) ? input.reason?.trim() : undefined,
    status: issue ? 'issued' : 'draft',
    issuedAt,
    discount: invoiceTotals(lines, input.discount).discount,
    notes: input.notes?.trim() || undefined,
    isInternal: false,
    salesChannel,
    createdAt: new Date().toISOString(),
  }

  if (issue) {
    const shortage = findShortage(db, invoice, lines, 1)
    if (shortage) return delayedFailure(shortageMessage(shortage))
  }

  const result = writeDb((current) => {
    current.invoices.push(invoice)
    current.invoiceLines.push(...lines)
    if (issue) applyStock(current, invoice, lines, 1)
    return { ...invoice, lines: lines.map((line) => ({ ...line })) }
  })

  return delay(result)
}

/** Drafts only: a posted document is history, and is corrected by a return. */
export async function updateInvoice(id: string, input: InvoiceInput): Promise<InvoiceWithLines> {
  const db = readDb()
  const existing = db.invoices.find((candidate) => candidate.id === id)
  if (!existing) return delayedFailure(`Document "${id}" no longer exists.`)
  if (existing.status !== 'draft') {
    return delayedFailure(`${existing.number} has been issued and can no longer be edited. Raise a return instead.`)
  }

  const lines = normalizeLines(db, input.kind, id, input.lines)
  if (typeof lines === 'string') return delayedFailure(lines)
  const duplicate = findDuplicateLine(lines)
  if (duplicate) return delayedFailure(`${duplicate.sku} is listed on two lines. Combine them into one.`)

  const result = writeDb((current) => {
    const invoice = current.invoices.find((candidate) => candidate.id === id)
    if (!invoice) return null
    Object.assign(invoice, {
      kind: input.kind,
      branchId: input.branchId,
      partyName: isAdjustmentKind(input.kind) ? '' : input.partyName.trim(),
      reason: isAdjustmentKind(input.kind) ? input.reason?.trim() : undefined,
      issuedAt: toIsoDate(input.issuedAt),
      discount: invoiceTotals(lines, input.discount).discount,
      notes: input.notes?.trim() || undefined,
      salesChannel: isCustomerSaleKind(input.kind) ? (input.salesChannel ?? invoice.salesChannel ?? 'b2c') : undefined,
    })
    current.invoiceLines = current.invoiceLines.filter((line) => line.invoiceId !== id)
    current.invoiceLines.push(...lines)
    return { ...invoice, lines: lines.map((line) => ({ ...line })) }
  })

  if (!result) return delayedFailure(`Document "${id}" no longer exists.`)
  return delay(result)
}

export async function issueInvoice(id: string): Promise<Invoice> {
  const db = readDb()
  const invoice = db.invoices.find((candidate) => candidate.id === id)
  if (!invoice) return delayedFailure(`Document "${id}" no longer exists.`)
  if (invoice.status !== 'draft') return delayedFailure(`${invoice.number} is already ${invoice.status}.`)

  const lines = linesOf(db, id)
  if (lines.length === 0) return delayedFailure(`${invoice.number} has no lines to issue.`)

  const shortage = findShortage(db, invoice, lines, 1)
  if (shortage) return delayedFailure(shortageMessage(shortage))

  const result = writeDb((current) => {
    const stored = current.invoices.find((candidate) => candidate.id === id)
    if (!stored) return null
    stored.status = 'issued'
    applyStock(current, stored, linesOf(current, id), 1)
    return { ...stored }
  })

  if (!result) return delayedFailure(`Document "${id}" no longer exists.`)
  return delay(result)
}

export async function markInvoicePaid(id: string): Promise<Invoice> {
  const invoice = readDb().invoices.find((candidate) => candidate.id === id)
  if (!invoice) return delayedFailure(`Document "${id}" no longer exists.`)
  if (invoice.status !== 'issued') return delayedFailure('Only an issued document can be marked paid.')

  const result = writeDb((db) => {
    const stored = db.invoices.find((candidate) => candidate.id === id)
    if (!stored) return null
    stored.status = 'paid'
    return { ...stored }
  })

  if (!result) return delayedFailure(`Document "${id}" no longer exists.`)
  return delay(result)
}

/** Reverses a posted document's stock and keeps it on file as void. */
export async function voidInvoice(id: string): Promise<Invoice> {
  const db = readDb()
  const invoice = db.invoices.find((candidate) => candidate.id === id)
  if (!invoice) return delayedFailure(`Document "${id}" no longer exists.`)
  if (invoice.status === 'void') return delayedFailure(`${invoice.number} is already void.`)
  if (invoice.status === 'draft') return delayedFailure(`${invoice.number} is a draft. Delete it instead.`)

  const lines = linesOf(db, id)
  const shortage = findShortage(db, invoice, lines, -1)
  if (shortage) {
    return delayedFailure(
      `Voiding ${invoice.number} would take ${shortage.line.quantity} of ${shortage.line.sku} back out of ${shortage.branchName}, which holds only ${shortage.available}. Raise a return instead.`,
    )
  }

  const result = writeDb((current) => {
    const stored = current.invoices.find((candidate) => candidate.id === id)
    if (!stored) return null
    applyStock(current, stored, linesOf(current, id), -1)
    stored.status = 'void'
    return { ...stored }
  })

  if (!result) return delayedFailure(`Document "${id}" no longer exists.`)
  return delay(result)
}

/** Drafts only: nothing has moved, so nothing needs reversing. */
export async function deleteInvoice(id: string): Promise<void> {
  const invoice = readDb().invoices.find((candidate) => candidate.id === id)
  if (!invoice) return delayedFailure(`Document "${id}" no longer exists.`)
  if (invoice.status !== 'draft') {
    return delayedFailure(`${invoice.number} has been issued and stays on file. Void it instead.`)
  }

  writeDb((db) => {
    db.invoices = db.invoices.filter((candidate) => candidate.id !== id)
    db.invoiceLines = db.invoiceLines.filter((line) => line.invoiceId !== id)
  })
  return delay(undefined)
}
