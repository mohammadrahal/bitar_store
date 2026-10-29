import { readDb } from '@/mocks/store'
import { listSales } from '@/services/sales.service'
import { visibleBranchIds, visibleScope } from '@/services/mock-ledger'
import { ALL_BRANCHES, type BranchScope, type SalesAnalytics, type SalesSeries, type TopSellerRow } from '@/types'

/** Beyond this many branches the chart folds the tail into one "Other" series. */
const MAX_BRANCH_SERIES = 5
const TOP_PRODUCTS = 8
const OTHER_BRANCH_ID = 'other'
const SALES_PAGE = 200

interface Tally {
  units: number
  revenue: number
}

function money(value: number) {
  return Math.round(value * 100) / 100
}

/**
 * What sold, read from `GET /sales` — the completed POS sales the server holds,
 * not the local document ledger. The endpoint answers one business date at a
 * time per branch, so these figures cover the current business date; a period
 * needs an analytics endpoint, which is listed in ARCHITECTURE.md section 9.
 */
export async function getSalesAnalytics(scope: BranchScope = ALL_BRANCHES): Promise<SalesAnalytics> {
  const db = readDb()
  const wanted = visibleScope(scope)
  const visible = new Set(visibleBranchIds(db))
  const branches = db.branches.filter(
    (branch) => visible.has(branch.id) && (wanted === ALL_BRANCHES || branch.id === wanted),
  )

  const branchTotals = new Map<string, Tally>()
  const productTotals = new Map<string, Tally & { productName: string; byBranch: Map<string, number> }>()
  let documentCount = 0
  let businessDate = ''

  for (const branch of branches) {
    const result = await listSales({ branchId: branch.id, limit: SALES_PAGE })
    businessDate = businessDate || result.businessDate

    for (const sale of result.sales) {
      documentCount += 1
      for (const line of sale.lines) {
        const revenue = Number(line.lineTotal)
        const units = line.quantity

        const tally = branchTotals.get(branch.id) ?? { units: 0, revenue: 0 }
        tally.units += units
        tally.revenue += revenue
        branchTotals.set(branch.id, tally)

        const product = productTotals.get(line.styleName) ?? {
          units: 0,
          revenue: 0,
          productName: line.styleName,
          byBranch: new Map<string, number>(),
        }
        product.units += units
        product.revenue += revenue
        product.byBranch.set(branch.id, (product.byBranch.get(branch.id) ?? 0) + units)
        productTotals.set(line.styleName, product)
      }
    }
  }

  const named = [...branchTotals.entries()]
    .map(([branchId, tally]) => ({
      branchId,
      branchName: db.branches.find((branch) => branch.id === branchId)?.name ?? 'Unknown location',
      units: tally.units,
      revenue: money(tally.revenue),
    }))
    .sort((a, b) => b.revenue - a.revenue || a.branchName.localeCompare(b.branchName))

  /**
   * Series order is by name, never by revenue: a colour has to follow the
   * branch, so a good day cannot repaint the chart. Rows are still sorted by
   * revenue for reading — that is ordering, not recolouring. The same rule
   * decides which branches keep a hue when the tail folds.
   */
  const byName = [...named].sort((a, b) => a.branchName.localeCompare(b.branchName))
  const kept = byName.slice(0, MAX_BRANCH_SERIES)
  const folded = byName.slice(MAX_BRANCH_SERIES)
  const series: SalesSeries[] = kept.map((branch) => ({ id: branch.branchId, name: branch.branchName }))
  if (folded.length > 0) series.push({ id: OTHER_BRANCH_ID, name: 'Other locations' })

  const keptIds = new Set(kept.map((branch) => branch.branchId))
  const topProducts: TopSellerRow[] = [...productTotals.values()]
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

  return {
    businessDate,
    series,
    topProducts,
    byBranch: named,
    documentCount,
    totalUnits: named.reduce((sum, branch) => sum + branch.units, 0),
    totalRevenue: money(named.reduce((sum, branch) => sum + branch.revenue, 0)),
  }
}
