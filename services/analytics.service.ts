import { delay } from '@/lib/delay'
import { isPosted, isRevenueDocument, revenueSign } from '@/lib/invoices'
import { readDb } from '@/mocks/store'
import { ALL_BRANCHES, type BranchScope, type SalesAnalytics, type SalesSeries, type TopSellerRow } from '@/types'

/** Beyond this many branches the chart folds the tail into one "Other" series. */
const MAX_BRANCH_SERIES = 5
const TOP_PRODUCTS = 8
const OTHER_BRANCH_ID = 'other'

interface Tally {
  units: number
  revenue: number
}

function emptyTally(): Tally {
  return { units: 0, revenue: 0 }
}

function money(value: number) {
  return Math.round(value * 100) / 100
}

/**
 * Sales performance from the document ledger: which products sell and where.
 * Only external sales and their returns count, so a transfer between branches
 * never inflates revenue, and only posted documents count, so a draft does not
 * either. Returns subtract, which is why a figure here can fall.
 */
export async function getSalesAnalytics(scope: BranchScope = ALL_BRANCHES): Promise<SalesAnalytics> {
  const db = readDb()

  const branchTotals = new Map<string, Tally>()
  const productTotals = new Map<string, Tally & { productName: string; byBranch: Map<string, number> }>()
  let documentCount = 0

  for (const invoice of db.invoices) {
    if (!isPosted(invoice) || !isRevenueDocument(invoice)) continue
    if (scope !== ALL_BRANCHES && invoice.branchId !== scope) continue

    const lines = db.invoiceLines.filter((line) => line.invoiceId === invoice.id)
    if (lines.length === 0) continue
    documentCount += 1

    const sign = revenueSign(invoice.kind)
    const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)

    for (const line of lines) {
      const lineSubtotal = line.quantity * line.unitPrice
      // The invoice-level discount is shared out pro rata, so the product
      // figures add up to the document totals rather than drifting from them.
      const share = subtotal > 0 ? lineSubtotal / subtotal : 0
      const revenue = sign * (lineSubtotal - invoice.discount * share)
      const units = sign * line.quantity

      const branch = branchTotals.get(invoice.branchId) ?? emptyTally()
      branch.units += units
      branch.revenue += revenue
      branchTotals.set(invoice.branchId, branch)

      const product = productTotals.get(line.productName) ?? {
        ...emptyTally(),
        productName: line.productName,
        byBranch: new Map<string, number>(),
      }
      product.units += units
      product.revenue += revenue
      product.byBranch.set(invoice.branchId, (product.byBranch.get(invoice.branchId) ?? 0) + units)
      productTotals.set(line.productName, product)
    }
  }

  const named = [...branchTotals.entries()]
    .map(([branchId, tally]) => ({
      branchId,
      branchName: db.branches.find((branch) => branch.id === branchId)?.name ?? 'Unknown branch',
      units: tally.units,
      revenue: money(tally.revenue),
    }))
    .sort((a, b) => b.revenue - a.revenue || a.branchName.localeCompare(b.branchName))

  /**
   * Series order is by name, never by revenue: a colour has to follow the
   * branch, so a good month cannot repaint the chart. Rows are still sorted by
   * revenue for reading — that is ordering, not recolouring. The same rule
   * decides which branches keep a hue when the tail folds.
   */
  const byName = [...named].sort((a, b) => a.branchName.localeCompare(b.branchName))
  const kept = byName.slice(0, MAX_BRANCH_SERIES)
  const folded = byName.slice(MAX_BRANCH_SERIES)
  const series: SalesSeries[] = kept.map((branch) => ({ id: branch.branchId, name: branch.branchName }))
  if (folded.length > 0) series.push({ id: OTHER_BRANCH_ID, name: 'Other branches' })

  const keptIds = new Set(kept.map((branch) => branch.branchId))
  const topProducts: TopSellerRow[] = [...productTotals.values()]
    // A product returned as often as it sold nets to zero and is not a seller;
    // it would draw a bar of no length.
    .filter((product) => product.units > 0)
    .sort((a, b) => b.units - a.units || b.revenue - a.revenue)
    .slice(0, TOP_PRODUCTS)
    .map((product) => {
      const byBranch: Record<string, number> = {}
      for (const [branchId, units] of product.byBranch) {
        const key = keptIds.has(branchId) ? branchId : OTHER_BRANCH_ID
        byBranch[key] = (byBranch[key] ?? 0) + units
      }
      return {
        productName: product.productName,
        units: product.units,
        revenue: money(product.revenue),
        byBranch,
      }
    })

  return delay({
    series,
    topProducts,
    byBranch: named,
    documentCount,
    totalUnits: named.reduce((sum, branch) => sum + branch.units, 0),
    totalRevenue: money(named.reduce((sum, branch) => sum + branch.revenue, 0)),
  })
}
