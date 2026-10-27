import { delay, delayedFailure } from '@/lib/delay'
import { createId } from '@/lib/ids'
import { commitDb, readDb, type MockDb } from '@/mocks/store'
import { postAdjustments, type AdjustmentItem } from '@/services/adjustment-docs'
import { actorName, branchNameOf, ensureLevel, levelOf, remember, replayOf, visibleBranchIds } from '@/services/mock-ledger'
import { permissionError } from '@/services/transfer-helpers'
import { ALL_BRANCHES, type BranchScope, type CountReport, type CountReportRow, type CountSheetRow } from '@/types'

/** Every live variant the branch carries, with what the system expects on the shelf. */
export async function getCountSheet(branchId: string): Promise<CountSheetRow[]> {
  const db = readDb()
  if (!visibleBranchIds(db).includes(branchId)) return delayedFailure("You don't have access to this branch.")
  const rows = db.variants.flatMap<CountSheetRow>((variant) => {
    const product = db.products.find((candidate) => candidate.id === variant.productId)
    if (!product || product.archived || variant.archived || !levelOf(db, variant.id, branchId)) return []
    return [
      {
        variantId: variant.id,
        productName: product.name,
        sku: variant.sku,
        size: variant.size,
        color: variant.color,
        onHand: levelOf(db, variant.id, branchId)?.quantity ?? 0,
      },
    ]
  })
  rows.sort((a, b) => a.sku.localeCompare(b.sku))
  return delay(rows)
}

/** A count cannot go below what is promised to transfers or set aside. */
function floorError(db: MockDb, branchId: string, variantId: string, counted: number) {
  const level = levelOf(db, variantId, branchId)
  const committed = (level?.reserved ?? 0) + (level?.onHold ?? 0)
  if (counted >= committed) return null
  const sku = db.variants.find((variant) => variant.id === variantId)?.sku ?? variantId
  return `${sku}: ${committed} units are reserved or on hold, so the count cannot be ${counted}. Resolve those first.`
}

export interface CountInput {
  branchId: string
  note: string
  counts: { variantId: string; counted: number }[]
}

/** Applies a physical count as adjustment documents. Returns the document numbers. */
export async function applyCount(input: CountInput, idempotencyKey?: string): Promise<string[]> {
  const db = readDb()
  const replay = replayOf<string[]>(db, idempotencyKey)
  if (replay) return delay(replay)
  const denied = permissionError('stock:count', input.branchId, db)
  if (denied) return delayedFailure(denied)

  const items: AdjustmentItem[] = []
  for (const { variantId, counted } of input.counts) {
    if (!Number.isInteger(counted) || counted < 0) return delayedFailure('Counts must be whole units, 0 or more.')
    const floor = floorError(db, input.branchId, variantId, counted)
    if (floor) return delayedFailure(floor)
    const delta = counted - (levelOf(db, variantId, input.branchId)?.quantity ?? 0)
    if (delta !== 0) items.push({ variantId, delta })
  }
  if (items.length === 0) return delayedFailure('Every count matches what is on file. Nothing to correct.')

  const reason = `Physical count${input.note.trim() ? `: ${input.note.trim()}` : ''}`
  const numbers = postAdjustments(db, input.branchId, reason, items).map((invoice) => invoice.number)
  const result = remember(db, idempotencyKey, numbers)
  commitDb(db)
  return delay(result)
}

export interface CountReportInput {
  branchId: string
  variantId: string
  counted: number
  note: string
}

/** What an employee does instead of correcting: say what they found and let a manager decide. */
export async function reportCount(input: CountReportInput, idempotencyKey?: string): Promise<CountReport> {
  const db = readDb()
  const replay = replayOf<CountReport>(db, idempotencyKey)
  if (replay) return delay(replay)
  const denied = permissionError('stock:report', input.branchId, db)
  if (denied) return delayedFailure(denied)
  const expected = levelOf(db, input.variantId, input.branchId)?.quantity ?? 0
  if (input.counted === expected) return delayedFailure('That matches what is on file, so there is nothing to report.')

  const report: CountReport = {
    id: createId('cr'),
    variantId: input.variantId,
    branchId: input.branchId,
    expected,
    counted: input.counted,
    note: input.note.trim(),
    status: 'open',
    reportedBy: actorName(),
    createdAt: new Date().toISOString(),
  }
  db.countReports.push(report)
  const result = remember(db, idempotencyKey, report)
  commitDb(db)
  return delay(result)
}

export async function listCountReports(scope: BranchScope): Promise<CountReportRow[]> {
  const db = readDb()
  const visible = new Set(visibleBranchIds(db))
  const rows = db.countReports
    .filter((report) => visible.has(report.branchId) && (scope === ALL_BRANCHES || report.branchId === scope))
    .map((report) => {
      const variant = db.variants.find((candidate) => candidate.id === report.variantId)
      const product = variant && db.products.find((candidate) => candidate.id === variant.productId)
      return {
        ...report,
        productName: product?.name ?? 'Unknown product',
        sku: variant?.sku ?? report.variantId,
        size: variant?.size ?? '',
        color: variant?.color ?? '',
        branchName: branchNameOf(db, report.branchId),
      }
    })
    .sort((a, b) => Number(a.status !== 'open') - Number(b.status !== 'open') || b.createdAt.localeCompare(a.createdAt))
  return delay(rows)
}

/** Applying moves on hand by the reported difference; dismissing just closes the report. */
export async function resolveCountReport(reportId: string, apply: boolean, idempotencyKey?: string): Promise<CountReport> {
  const db = readDb()
  const replay = replayOf<CountReport>(db, idempotencyKey)
  if (replay) return delay(replay)
  const report = db.countReports.find((candidate) => candidate.id === reportId)
  if (!report || report.status !== 'open') return delayedFailure('This report has already been resolved.')
  const denied = permissionError('stock:count', report.branchId, db)
  if (denied) return delayedFailure(denied)

  if (apply) {
    const delta = report.counted - report.expected
    const target = (levelOf(db, report.variantId, report.branchId)?.quantity ?? 0) + delta
    const floor = floorError(db, report.branchId, report.variantId, target)
    if (floor) return delayedFailure(floor)
    ensureLevel(db, report.variantId, report.branchId)
    postAdjustments(db, report.branchId, `Count report by ${report.reportedBy}: ${report.note || 'difference found'}`, [
      { variantId: report.variantId, delta },
    ])
  }
  report.status = apply ? 'applied' : 'dismissed'
  report.resolvedAt = new Date().toISOString()
  report.resolvedBy = actorName()
  const result = remember(db, idempotencyKey, { ...report })
  commitDb(db)
  return delay(result)
}
