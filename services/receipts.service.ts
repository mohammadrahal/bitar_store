import { delay, delayedFailure } from '@/lib/delay'
import { createId } from '@/lib/ids'
import { can } from '@/lib/permissions'
import { commitDb, readDb, type MockDb } from '@/mocks/store'
import { actorName, branchNameOf, callerSeesCosts } from '@/services/mock-ledger'
import { useUserStore } from '@/store/user-store'
import type { Receipt, ReceiptLine, ReceiptRow, ReceiptStatus } from '@/types'

/*
 * BL-06 supplier receipts. Always at the warehouse. A draft has no effect;
 * confirming applies it once and nothing more may be edited afterwards — a
 * mistake is fixed by a correction, which is its own linked record with a
 * reason.
 *
 * There is no goods-receipt endpoint, so a confirmed receipt does not move
 * server stock: `POST /stock/opening` only accepts a SKU with no movement at
 * that branch, which is the opening count, not receiving. The screen says so,
 * and the endpoint is listed in ARCHITECTURE.md section 9.
 */

function holds(permission: 'receipts.enter' | 'receipts.confirm' | 'costs.view'): boolean {
  const user = useUserStore.getState().user
  return Boolean(user && can(user, permission))
}

function nextNumber(db: MockDb): string {
  const seq = db.receiptSeq
  db.receiptSeq = seq + 1
  return `GRN-${String(seq).padStart(4, '0')}`
}

function toRow(db: MockDb, receipt: Receipt): ReceiptRow {
  const seesCosts = callerSeesCosts()
  const lines = receipt.lines.map((line) => {
    const variant = db.variants.find((candidate) => candidate.id === line.variantId)
    const product = variant && db.products.find((candidate) => candidate.id === variant.productId)
    return {
      ...line,
      /* Cost is withheld rather than shown as zero-the-fact: the caller may not see it. */
      unitCost: seesCosts ? line.unitCost : 0,
      sku: variant?.sku ?? line.variantId,
      label: variant && product ? `${product.name} ${variant.color} / ${variant.size}` : 'Unknown variant',
    }
  })
  return {
    ...receipt,
    lines,
    supplierName: db.suppliers.find((supplier) => supplier.id === receipt.supplierId)?.name ?? 'Unknown supplier',
    branchName: branchNameOf(db, receipt.branchId),
    units: receipt.lines.reduce((sum, line) => sum + line.quantity, 0),
    total: seesCosts ? receipt.lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0) : 0,
  }
}

export async function listReceipts(status?: ReceiptStatus | 'all'): Promise<ReceiptRow[]> {
  const db = readDb()
  const rows = db.receipts
    .filter((receipt) => !status || status === 'all' || receipt.status === status)
    .map((receipt) => toRow(db, receipt))
    .sort((a, b) => b.number.localeCompare(a.number))
  return delay(rows)
}

export async function getReceipt(receiptId: string): Promise<ReceiptRow> {
  const db = readDb()
  const receipt = db.receipts.find((candidate) => candidate.id === receiptId)
  if (!receipt) return delayedFailure('That receipt no longer exists.')
  return delay(toRow(db, receipt))
}

export interface ReceiptInput {
  supplierId: string
  receivedOn: string
  invoiceReference?: string
  attachmentName?: string
  lines: ReceiptLine[]
}

function validate(db: MockDb, input: ReceiptInput): string | null {
  if (!db.suppliers.some((supplier) => supplier.id === input.supplierId)) return 'Pick a supplier.'
  if (!input.receivedOn) return 'Say which date the goods arrived.'
  const lines = input.lines.filter((line) => line.quantity > 0)
  if (lines.length === 0) return 'Add at least one accepted quantity.'
  if (lines.some((line) => line.unitCost < 0)) return 'A unit cost cannot be negative.'
  return null
}

/** A draft, which has no stock effect. `receipts.enter` is enough to raise one. */
export async function createReceiptDraft(input: ReceiptInput): Promise<ReceiptRow> {
  if (!holds('receipts.enter')) return delayedFailure('You cannot enter supplier receipts.')
  const db = readDb()
  if (!db.warehouseId) {
    return delayedFailure('Mark one location as the main warehouse first: receipts always land there.')
  }
  const invalid = validate(db, input)
  if (invalid) return delayedFailure(invalid)
  if (input.lines.some((line) => line.unitCost > 0) && !holds('costs.view')) {
    return delayedFailure('You cannot enter costs. Leave them blank for a manager to fill in.')
  }

  const receipt: Receipt = {
    id: createId('grn'),
    number: nextNumber(db),
    supplierId: input.supplierId,
    branchId: db.warehouseId,
    receivedOn: input.receivedOn,
    invoiceReference: input.invoiceReference?.trim() || undefined,
    attachmentName: input.attachmentName || undefined,
    status: 'draft',
    lines: input.lines.filter((line) => line.quantity > 0),
    createdAt: new Date().toISOString(),
    createdBy: actorName(),
  }
  db.receipts.push(receipt)
  commitDb(db)
  return delay(toRow(db, receipt))
}

export async function updateReceiptDraft(receiptId: string, input: ReceiptInput): Promise<ReceiptRow> {
  if (!holds('receipts.enter')) return delayedFailure('You cannot enter supplier receipts.')
  const db = readDb()
  const receipt = db.receipts.find((candidate) => candidate.id === receiptId)
  if (!receipt) return delayedFailure('That receipt no longer exists.')
  if (receipt.status !== 'draft') {
    return delayedFailure('A confirmed receipt cannot be edited. Raise a correction instead.')
  }
  const invalid = validate(db, input)
  if (invalid) return delayedFailure(invalid)

  receipt.supplierId = input.supplierId
  receipt.receivedOn = input.receivedOn
  receipt.invoiceReference = input.invoiceReference?.trim() || undefined
  receipt.attachmentName = input.attachmentName || receipt.attachmentName
  receipt.lines = input.lines.filter((line) => line.quantity > 0)
  commitDb(db)
  return delay(toRow(db, receipt))
}

/**
 * Applies the receipt, once. Only a super admin or manager may, and the status
 * check is what stops a second confirmation adding the same units twice.
 */
export async function confirmReceipt(receiptId: string): Promise<ReceiptRow> {
  if (!holds('receipts.confirm')) return delayedFailure('Only a super admin or manager can confirm a receipt.')
  const db = readDb()
  const receipt = db.receipts.find((candidate) => candidate.id === receiptId)
  if (!receipt) return delayedFailure('That receipt no longer exists.')
  if (receipt.status === 'confirmed') return delayedFailure('This receipt is already confirmed.')
  if (receipt.status !== 'draft') return delayedFailure('Only a draft can be confirmed.')

  receipt.status = 'confirmed'
  receipt.confirmedAt = new Date().toISOString()
  receipt.confirmedBy = actorName()
  commitDb(db)
  return delay(toRow(db, receipt))
}

export async function cancelReceipt(receiptId: string): Promise<ReceiptRow> {
  if (!holds('receipts.enter')) return delayedFailure('You cannot change supplier receipts.')
  const db = readDb()
  const receipt = db.receipts.find((candidate) => candidate.id === receiptId)
  if (!receipt) return delayedFailure('That receipt no longer exists.')
  if (receipt.status !== 'draft') return delayedFailure('Only a draft can be cancelled.')

  receipt.status = 'cancelled'
  commitDb(db)
  return delay(toRow(db, receipt))
}

export interface CorrectionInput extends ReceiptInput {
  reason: string
}

/**
 * A correction to a confirmed receipt: a new record holding the figures as they
 * should have been, linked back to the one it fixes, which becomes "corrected".
 */
export async function correctReceipt(receiptId: string, input: CorrectionInput): Promise<ReceiptRow> {
  if (!holds('receipts.confirm')) return delayedFailure('Only a super admin or manager can correct a receipt.')
  if (!input.reason.trim()) return delayedFailure('A correction needs a reason.')

  const db = readDb()
  const original = db.receipts.find((candidate) => candidate.id === receiptId)
  if (!original) return delayedFailure('That receipt no longer exists.')
  if (original.status !== 'confirmed') return delayedFailure('Only a confirmed receipt can be corrected.')
  const invalid = validate(db, input)
  if (invalid) return delayedFailure(invalid)

  const now = new Date().toISOString()
  const correction: Receipt = {
    id: createId('grn'),
    number: nextNumber(db),
    supplierId: input.supplierId,
    branchId: original.branchId,
    receivedOn: input.receivedOn,
    invoiceReference: input.invoiceReference?.trim() || undefined,
    attachmentName: input.attachmentName || undefined,
    status: 'confirmed',
    lines: input.lines.filter((line) => line.quantity > 0),
    correctsId: original.id,
    correctionReason: input.reason.trim(),
    createdAt: now,
    createdBy: actorName(),
    confirmedAt: now,
    confirmedBy: actorName(),
  }
  original.status = 'corrected'
  db.receipts.push(correction)
  commitDb(db)
  return delay(toRow(db, correction))
}

/**
 * Unit cost per variant from the newest confirmed receipt that mentions it.
 * This is the only cost in the system: a model does not carry one (BL-06).
 */
export function latestConfirmedCosts(): Map<string, number> {
  const costs = new Map<string, number>()
  const confirmed = readDb()
    .receipts.filter((receipt) => receipt.status === 'confirmed')
    .sort((a, b) => (a.confirmedAt ?? '').localeCompare(b.confirmedAt ?? ''))

  for (const receipt of confirmed) {
    for (const line of receipt.lines) costs.set(line.variantId, line.unitCost)
  }
  return costs
}

export async function costOfVariant(variantId: string): Promise<number> {
  if (!callerSeesCosts()) return 0
  return delay(latestConfirmedCosts().get(variantId) ?? 0, 0)
}
