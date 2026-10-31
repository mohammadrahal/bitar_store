import { delay } from '@/lib/delay'
import type { StockOverview } from '@/services/stock-stats.service'
import { ALL_BRANCHES, type BranchScope, type BranchStockRow, type StockStatus } from '@/types'

export function statusOf(available: number): StockStatus {
  return available === 0 ? 'out' : 'healthy'
}

/** Total units a branch currently holds, used to guard branch deletion. */
export async function getBranchStockUnits(branchId: string): Promise<number> {
  const { branchStockUnitsFromApi } = await import('@/services/stock-api.service')
  return delay(await branchStockUnitsFromApi(branchId))
}

/*
 * The figures below come from `GET /stock`, not the local store: the server
 * owns the quantities. They live in stock-stats.service.ts so this file stays
 * the one place hooks import stock reads from.
 */
export async function getStockOverview(scope: BranchScope = ALL_BRANCHES): Promise<StockOverview> {
  const { stockOverviewFromApi } = await import('@/services/stock-stats.service')
  return stockOverviewFromApi(scope)
}

/** Everything a branch holds, emptiest first, for the branch stock list. */
export async function listBranchStock(branchId: string): Promise<BranchStockRow[]> {
  const { listBranchStockFromApi } = await import('@/services/stock-api.service')
  return delay(await listBranchStockFromApi(branchId))
}

/** Available quantity per variant at one branch, keyed by variant id. */
export async function getBranchStockMap(branchId: string): Promise<Record<string, number>> {
  const { branchSellableMap } = await import('@/services/stock-api.service')
  const map = await branchSellableMap(branchId)
  return delay(Object.fromEntries(map))
}
