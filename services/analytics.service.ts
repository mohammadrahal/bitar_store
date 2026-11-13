import { priceOf } from '@/lib/api/map-catalog'
import type { ApiSalesSummary } from '@/lib/api/types'
import type { DateRange } from '@/lib/dashboard-range'
import { readDb } from '@/lib/catalog-cache/store'
import { fetchSalesSummary, fetchTopSkus } from '@/services/reports-api.service'
import { fetchTodayBranchSales } from '@/services/today-branch-sales.service'
import { ALL_BRANCHES, type BranchScope, type SalesAnalytics, type SalesSeries, type TopSellerRow } from '@/types'

/**
 * What the returns approved in the period gave back, and revenue net of it.
 *
 * Both fields arrived with the returns API and an older server omits them, so
 * these are the only safe way to read them: a missing `refunds` means "no
 * returns data from this server", which is **not** the same as "no returns" but
 * is the only figure it can honestly show. `netRevenueOf` therefore falls back
 * to gross revenue rather than to zero.
 *
 * `netRevenue` can be negative for a branch that handed money back on goods
 * another branch sold. That is the truth about that branch's day, so it is
 * passed through unclamped.
 */
export function refundsOf(row: { refunds?: string }): number | null {
  return row.refunds === undefined ? null : priceOf(row.refunds)
}

export function netRevenueOf(row: { revenue: string; netRevenue?: string }): number {
  return row.netRevenue === undefined ? priceOf(row.revenue) : priceOf(row.netRevenue)
}

/** Beyond this many branches the chart folds the tail into one "Other" series. */
const MAX_BRANCH_SERIES = 5
const TOP_PRODUCTS = 8
/** The most `GET /reports/top-skus` will return. */
const TOP_SKUS_MAX = 100
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

/**
 * One row per branch over the whole window.
 *
 * `byBranch` is the server's own split (9 Nov) and includes branches that sold
 * nothing. Before it existed this read `rows`, which is a **day x branch**
 * grid: a branch that sold on five days arrived as five rows and was charted
 * five times, each with one day's revenue. The fallback folds that grid by
 * branch so an older server gives the same answer rather than a wrong one.
 *
 * Revenue is never summed across the splits: `inStore + socialMedia` and
 * `cash + whish` are two views of the same money.
 */
function branchTotalsOf(summary: ApiSalesSummary) {
  const nameOf = (branch: ApiSalesSummary['rows'][number]['branch']) =>
    'name' in branch ? branch.name : branch.id

  const folded = new Map<string, { branchId: string; branchName: string; units: number; revenue: number }>()
  const source = summary.byBranch ?? summary.rows
  for (const row of source) {
    const existing = folded.get(row.branch.id)
    if (existing) {
      existing.units += row.items
      existing.revenue += priceOf(row.revenue)
    } else {
      folded.set(row.branch.id, {
        branchId: row.branch.id,
        branchName: nameOf(row.branch),
        units: row.items,
        revenue: priceOf(row.revenue),
      })
    }
  }

  return [...folded.values()].sort(
    (a, b) => b.revenue - a.revenue || a.branchName.localeCompare(b.branchName),
  )
}

/**
 * Admin/manager charts: two report calls instead of one `GET /sales` per
 * branch. Both take the window the page is showing. without `from` and `to`
 * the server answers for today alone, which made "best sellers over 90 days"
 * a list of whatever happened to sell this morning.
 */
export async function getSalesAnalyticsFromReports(
  scope: BranchScope = ALL_BRANCHES,
  range?: DateRange,
): Promise<SalesAnalytics> {
  const window = range ? { from: range.from, to: range.to } : {}
  const params = { ...(scope === ALL_BRANCHES ? {} : { branchId: scope }), ...window }
  const [summary, topSkus] = await Promise.all([
    fetchSalesSummary(params),
    fetchTopSkus({ ...params, limit: TOP_SKUS_MAX }),
  ])

  const named = branchTotalsOf(summary)

  const series = seriesFromBranches(named)
  const bucketId = series[0]?.id ?? OTHER_BRANCH_ID

  const unitsByVariant = Object.fromEntries(topSkus.rows.map((row) => [row.sku.id, row.quantity]))
  const topProducts: TopSellerRow[] = topSkus.rows.slice(0, TOP_PRODUCTS).map((row) => ({
    variantId: row.sku.id,
    productName: row.sku.styleName,
    color: row.sku.color,
    size: row.sku.size,
    sku: row.sku.code,
    units: row.quantity,
    revenue: priceOf(row.revenue),
    /* Top-skus are scoped totals; branch split is not on the API yet. */
    byBranch: { [bucketId]: row.quantity },
  }))

  return {
    businessDate: summary.from,
    series,
    topProducts,
    unitsByVariant,
    unitsComplete: topSkus.rows.length < TOP_SKUS_MAX,
    byBranch: named,
    documentCount: summary.totals.salesCount,
    totalUnits: named.reduce((sum, branch) => sum + branch.units, 0),
    totalRevenue: priceOf(summary.totals.revenue),
  }
}

/**
 * What sold, read from `GET /sales` per branch. used when the caller lacks
 * `reports.financial`.
 */
export async function getSalesAnalyticsFromBranchSales(scope: BranchScope = ALL_BRANCHES): Promise<SalesAnalytics> {
  const db = readDb()
  const snapshot = await fetchTodayBranchSales(scope)
  const businessDate = snapshot.businessDate

  const branchTotals = new Map<string, Tally>()
  /* Keyed by variant, not by model: two sizes of the same dress are two things
     to restock, and a list that merges them cannot be acted on. */
  const variantTotals = new Map<
    string,
    Tally & { variantId: string; productName: string; color: string; size: string; sku: string; byBranch: Map<string, number> }
  >()
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

        const variant = variantTotals.get(line.skuId) ?? {
          units: 0,
          revenue: 0,
          variantId: line.skuId,
          productName: line.styleName,
          color: line.color,
          size: line.size,
          sku: line.skuCode,
          byBranch: new Map<string, number>(),
        }
        variant.units += units
        variant.revenue += revenue
        variant.byBranch.set(branchId, (variant.byBranch.get(branchId) ?? 0) + units)
        variantTotals.set(line.skuId, variant)
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
   * revenue for reading. that is ordering, not recolouring. The same rule
   * decides which branches keep a hue when the tail folds.
   */
  const series = seriesFromBranches(named)
  const keptIds = new Set(series.filter((entry) => entry.id !== OTHER_BRANCH_ID).map((entry) => entry.id))
  const topProducts: TopSellerRow[] = [...variantTotals.values()]
    .filter((variant) => variant.units > 0)
    .sort((a, b) => b.units - a.units || b.revenue - a.revenue)
    .slice(0, TOP_PRODUCTS)
    .map((variant) => {
      const byBranch: Record<string, number> = {}
      for (const [branchId, units] of variant.byBranch) {
        const key = keptIds.has(branchId) ? branchId : OTHER_BRANCH_ID
        byBranch[key] = (byBranch[key] ?? 0) + units
      }
      return {
        variantId: variant.variantId,
        productName: variant.productName,
        color: variant.color,
        size: variant.size,
        sku: variant.sku,
        units: variant.units,
        revenue: money(variant.revenue),
        byBranch,
      }
    })

  return {
    businessDate,
    series,
    topProducts,
    unitsByVariant: Object.fromEntries([...variantTotals.values()].map((variant) => [variant.variantId, variant.units])),
    unitsComplete: true,
    byBranch: named,
    documentCount,
    totalUnits: named.reduce((sum, branch) => sum + branch.units, 0),
    totalRevenue: money(named.reduce((sum, branch) => sum + branch.revenue, 0)),
  }
}
