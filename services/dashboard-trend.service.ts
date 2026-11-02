import { getApiClient } from '@/lib/api'
import { priceOf } from '@/lib/api/map-catalog'
import type { ApiSalesSummary, ApiSalesSummaryRow } from '@/lib/api/types'
import { addDays, toIsoDate } from '@/lib/dates'
import type { DateRange } from '@/lib/dashboard-range'
import { ALL_BRANCHES, type BranchScope } from '@/types'

export interface TrendPoint {
  /** `YYYY-MM-DD` shop day. */
  day: string
  revenue: number
  sales: number
}

/**
 * Two different splits of the same revenue, which is why they are separate
 * objects rather than four slices of one bar: `cash + whish` is how a sale was
 * paid, `inStore + socialMedia` is where it came from. Adding all four together
 * would count every sale twice.
 */
export interface RevenueSplit {
  label: string
  parts: { id: string; name: string; amount: number }[]
}

export interface DashboardTrend {
  points: TrendPoint[]
  revenue: number
  sales: number
  items: number
  discounts: number
  splits: RevenueSplit[]
}

function sumInto(target: TrendPoint, row: ApiSalesSummaryRow) {
  target.revenue += priceOf(row.revenue)
  target.sales += row.salesCount
}

/**
 * The server returns one row per day *per branch*, so a network-wide range
 * comes back with several rows for the same day. The chart plots one point per
 * day, and a day the shops did not sell on has no row at all — it still needs a
 * zero, or the line would join across the gap and imply trade that never
 * happened.
 */
function toPoints(payload: ApiSalesSummary, range: DateRange): TrendPoint[] {
  const byDay = new Map<string, TrendPoint>()
  for (const row of payload.rows) {
    let point = byDay.get(row.day)
    if (!point) {
      point = { day: row.day, revenue: 0, sales: 0 }
      byDay.set(row.day, point)
    }
    sumInto(point, row)
  }

  const points: TrendPoint[] = []
  const last = new Date(`${range.to}T00:00:00`)
  const first = new Date(`${range.from}T00:00:00`)
  for (let date = first; date <= last; date = addDays(date, 1)) {
    const day = toIsoDate(date)
    points.push(byDay.get(day) ?? { day, revenue: 0, sales: 0 })
  }
  return points
}

function splitsOf(totals: ApiSalesSummaryRow): RevenueSplit[] {
  return [
    {
      label: 'How it was paid',
      parts: [
        { id: 'cash', name: 'Cash', amount: priceOf(totals.cash) },
        { id: 'whish', name: 'Whish', amount: priceOf(totals.whish) },
      ],
    },
    {
      label: 'Where it came from',
      parts: [
        { id: 'in-store', name: 'In store', amount: priceOf(totals.inStore) },
        { id: 'social-media', name: 'Social media', amount: priceOf(totals.socialMedia) },
      ],
    },
  ]
}

function branchParam(scope: BranchScope) {
  return scope === ALL_BRANCHES ? undefined : scope
}

/** The revenue series and totals behind the overview's trend panel. */
export async function getDashboardTrend(scope: BranchScope, range: DateRange): Promise<DashboardTrend> {
  const payload = await getApiClient().getSalesSummary({
    branchId: branchParam(scope),
    from: range.from,
    to: range.to,
  })
  const { totals } = payload
  return {
    points: toPoints(payload, range),
    revenue: priceOf(totals.revenue),
    sales: totals.salesCount,
    items: totals.items,
    discounts: priceOf(totals.discounts),
    splits: splitsOf(totals),
  }
}

export interface TrendComparison {
  revenue: number
  sales: number
}

/** Just the headline figures for the preceding window, for the stat deltas. */
export async function getTrendComparison(scope: BranchScope, range: DateRange): Promise<TrendComparison> {
  const payload = await getApiClient().getSalesSummary({
    branchId: branchParam(scope),
    from: range.from,
    to: range.to,
  })
  return { revenue: priceOf(payload.totals.revenue), sales: payload.totals.salesCount }
}
