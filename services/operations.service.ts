import { delay } from '@/lib/delay'
import { invoiceTotals } from '@/lib/invoice-totals'
import { isPosted, isRevenueDocument, revenueSign } from '@/lib/invoices'
import { isOpenTransfer } from '@/lib/transfers'
import { readDb } from '@/mocks/store'
import { inTransitMap, visibleBranchIds, visibleScope } from '@/services/mock-ledger'
import { canSeeTransfer } from '@/services/transfer-helpers'
import { ALL_BRANCHES, type BranchScope, type OperationsSummary } from '@/types'

function isToday(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
}

/** The overview's operational cards: what is moving, held and sold today. */
export async function getOperationsSummary(requested: BranchScope): Promise<OperationsSummary> {
  const db = readDb()
  const scope = visibleScope(requested)
  const visible = new Set(visibleBranchIds(db))
  const inScope = (branchId: string) => visible.has(branchId) && (scope === ALL_BRANCHES || branchId === scope)

  const openTransfers = db.transfers.filter(
    (transfer) =>
      isOpenTransfer(transfer.status) &&
      canSeeTransfer(transfer) &&
      (inScope(transfer.fromBranchId) || inScope(transfer.toBranchId)),
  ).length

  let inTransitUnits = 0
  for (const [key, units] of inTransitMap(db)) {
    if (inScope(key.split('|')[1])) inTransitUnits += units
  }

  const onHoldUnits = db.stock.filter((level) => inScope(level.branchId)).reduce((sum, level) => sum + level.onHold, 0)

  let todaySales = 0
  let todayCents = 0
  for (const invoice of db.invoices) {
    if (!isPosted(invoice) || !isRevenueDocument(invoice) || !isToday(invoice.issuedAt) || !inScope(invoice.branchId)) continue
    if (invoice.kind === 'sale') todaySales += 1
    const lines = db.invoiceLines.filter((line) => line.invoiceId === invoice.id)
    todayCents += revenueSign(invoice.kind) * Math.round(invoiceTotals(lines, invoice.discount).total * 100)
  }

  return delay({ openTransfers, inTransitUnits, onHoldUnits, todaySales, todayRevenue: todayCents / 100 })
}
