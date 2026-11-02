import { priceOf } from '@/lib/api/map-catalog'
import { readDb } from '@/mocks/store'
import { fetchSalesSummary, fetchTopSkus } from '@/services/reports-api.service'
import { fetchTodayBranchSales } from '@/services/today-branch-sales.service'
import { ALL_BRANCHES, type BranchScope, type SalesAnalytics, type SalesSeries, type TopSellerRow } from '@/types'

/** Beyond this many branches the chart folds the tail into one "Other" series. */
const MAX_BRANCH_SERIES = 5
const TOP_PRODUCTS = 8
const OTHER_BRANCH_ID = 'other'
interface Tally {
  units: number
  revenue: number
}

function money(value: number) {
  return Math.round(value * 100) / 100
}

function seriesFromBranches(
  named: { branchId: string; branchName: string; units: number; revenue: number }[],
): SalesSeries[] {
  const byName = [...named].sort((a, b) => a.branchName.localeCompare(b.branchName))
  const kept = byName.slice(0, MAX_BRANCH_SERIES)
  const folded = byName.slice(MAX_BRANCH_SERIES)
  const series: SalesSeries[] = kept.map((branch) => ({ id: branch.branchId, name: branch.branchName }))
  if (folded.length > 0) series.push({ id: OTHER_BRANCH_ID, name: 'Other locations' })
  return series
}

/** Admin/manager charts: two report calls instead of one `GET /sales` per branch. */
export async function getSalesAnalyticsFromReports(scope: BranchScope = ALL_BRANCHES): Promise<SalesAnalytics> {
  const params = scope === ALL_BRANCHES ? {} : { branchId: scope }
  const [summary, topSkus] = await Promise.all([
    fetchSalesSummary(params),
    fetchTopSkus({ ...params, limit: TOP_PRODUCTS }),
  ])

  const named = summary.rows
    .map((row) => ({
      branchId: row.branch.id,
      branchName: 'name' in row.branch ? row.branch.name : row.branch.id,
      units: row.items,
      revenue: priceOf(row.revenue),
    }))
    .sort((a, b) => b.revenue - a.revenue || a.branchName.localeCompare(b.branchName))

  const series = seriesFromBranches(named)
  const bucketId = series[0]?.id ?? OTHER_BRANCH_ID

  const topProducts: TopSellerRow[] = topSkus.rows.map((row) => ({
    productName: row.sku.styleName,
    units: row.quantity,
    revenue: priceOf(row.revenue),
    /* Top-skus are scoped totals; branch split is not on the API yet. */
    byBranch: { [bucketId]: row.quantity },
  }))

  return {
    businessDate: summary.from,
    series,
    topProducts,
    byBranch: named,
    documentCount: summary.totals.salesCount,
    totalUnits: named.reduce((sum, branch) => sum + branch.units, 0),
    totalRevenue: priceOf(summary.totals.revenue),
  }
}

/**
 * What sold, read from `GET /sales` per branch — used when the caller lacks
 * `reports.financial`.
 */
export async function getSalesAnalyticsFromBranchSales(scope: BranchScope = ALL_BRANCHES): Promise<SalesAnalytics> {
  const db = readDb()
  const snapshot = await fetchTodayBranchSales(scope)
  const businessDate = snapshot.businessDate

  const branchTotals = new Map<string, Tally>()
  const productTotals = new Map<string, Tally & { productName: string; byBranch: Map<string, number> }>()
  let documentCount = 0

  for (const { branchId, sales } of snapshot.byBranch) {
    for (const sale of sales) {
      documentCount += 1
      for (const line of sale.lines) {
        const revenue = Number(line.lineTotal)
        const units = line.quantity

        const tally = branchTotals.get(branchId) ?? { units: 0, revenue: 0 }
        tally.units += units
        tally.revenue += revenue
        branchTotals.set(branchId, tally)

        const product = productTotals.get(line.styleName) ?? {
          units: 0,
          revenue: 0,
          productName: line.styleName,
          byBranch: new Map<string, number>(),
        }
        product.units += units
        product.revenue += revenue
        product.byBranch.set(branchId, (product.byBranch.get(branchId) ?? 0) + units)
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
  const series = seriesFromBranches(named)
  const keptIds = new Set(series.filter((entry) => entry.id !== OTHER_BRANCH_ID).map((entry) => entry.id))
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
