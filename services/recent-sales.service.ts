import { isApiFeatureMissing, noteMissingApiFeature } from '@/lib/api/capabilities'
import { priceOf } from '@/lib/api/map-catalog'
import { readDb } from '@/mocks/store'
import { getSalesHistory } from '@/services/sales.service'
import { fetchTodayBranchSales } from '@/services/today-branch-sales.service'
import { visibleScope } from '@/services/mock-ledger'
import { ALL_BRANCHES, type BranchScope } from '@/types'

/** One line of the overview's recent-sales table. */
export interface RecentSale {
  id: string
  reference: string
  /** ISO instant, formatted for display by the component. */
  soldAt: string
  branchId: string
  branchName: string
  items: number
  total: number
  /** "Cash", "Whish" or "Cash + Whish", from the amounts actually taken. */
  payment: string
}

function paymentLabel(cash: number, whish: number): string {
  if (cash > 0 && whish > 0) return 'Cash + Whish'
  if (whish > 0) return 'Whish'
  if (cash > 0) return 'Cash'
  return '—'
}

function branchNameOf(branchId: string, fallback?: string): string {
  if (fallback) return fallback
  return readDb().branches.find((branch) => branch.id === branchId)?.name ?? 'Unknown location'
}

/**
 * The last few completed sales, newest first.
 *
 * `GET /sales/history` is the right endpoint and the only one that crosses shop
 * days, but it has to be registered before `GET /sales/:id` or the server looks
 * up a sale whose id is the word "history" — which is exactly what this
 * deployment does. So a `404` falls back to today's `GET /sales` per branch,
 * and the panel says it is showing today only rather than silently appearing
 * empty on a quiet morning.
 */
export interface RecentSales {
  sales: RecentSale[]
  /** False when the figures could only be gathered for the current shop day. */
  acrossDays: boolean
}

async function fromHistory(scope: BranchScope, limit: number, from: string, to: string): Promise<RecentSales> {
  const result = await getSalesHistory({
    branchId: scope === ALL_BRANCHES ? undefined : scope,
    from,
    to,
    limit,
  })
  return {
    acrossDays: true,
    sales: result.sales.map((row) => ({
      id: row.id,
      reference: row.reference,
      soldAt: row.soldAt,
      branchId: row.branch.id,
      branchName: branchNameOf(row.branch.id, row.branch.name),
      items: row.items,
      total: priceOf(row.total),
      payment: paymentLabel(priceOf(row.cash), priceOf(row.whish)),
    })),
  }
}

async function fromToday(scope: BranchScope, limit: number): Promise<RecentSales> {
  const snapshot = await fetchTodayBranchSales(scope)
  const sales: RecentSale[] = []
  for (const { branchId, sales: rows } of snapshot.byBranch) {
    for (const sale of rows) {
      let cash = 0
      let whish = 0
      for (const payment of sale.payments) {
        if (payment.method === 'cash') cash += priceOf(payment.amount)
        else whish += priceOf(payment.amount)
      }
      sales.push({
        id: sale.id,
        reference: sale.reference,
        soldAt: sale.soldAt,
        branchId,
        branchName: branchNameOf(branchId),
        items: sale.lines.reduce((sum, line) => sum + line.quantity, 0),
        total: priceOf(sale.total),
        payment: paymentLabel(cash, whish),
      })
    }
  }
  sales.sort((a, b) => b.soldAt.localeCompare(a.soldAt))
  return { acrossDays: false, sales: sales.slice(0, limit) }
}

export async function getRecentSales(
  scope: BranchScope,
  limit: number,
  range: { from: string; to: string },
): Promise<RecentSales> {
  const resolved = visibleScope(scope)
  if (!isApiFeatureMissing('salesHistory')) {
    try {
      return await fromHistory(resolved, limit, range.from, range.to)
    } catch (error) {
      noteMissingApiFeature(error, 'salesHistory')
      if (!isApiFeatureMissing('salesHistory')) throw error
    }
  }
  return fromToday(resolved, limit)
}
