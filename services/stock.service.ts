import { delay, delayedFailure } from '@/lib/delay'
import { writeDb } from '@/mocks/store'
import type { StockOverview } from '@/services/stock-stats.service'
import { ALL_BRANCHES, type BranchScope, type BranchStockRow, type StockStatus } from '@/types'

export function statusOf(available: number, lowStockAt: number): StockStatus {
  if (available === 0) return 'out'
  return available <= lowStockAt ? 'low' : 'healthy'
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

export interface LowStockAtInput {
  variantId: string
  branchId: string
  lowStockAt: number
}

/**
 * The threshold is a policy number, not a fact, so it is the one stock value a
 * person sets by hand. The quantity beside it is only ever moved by a document.
 */
export async function setLowStockAt(input: LowStockAtInput): Promise<number> {
  if (!Number.isInteger(input.lowStockAt) || input.lowStockAt < 0) {
    return delayedFailure('A threshold must be a whole number of units, 0 or more.')
  }

  const saved = writeDb((db) => {
    const level = db.stock.find(
      (candidate) => candidate.variantId === input.variantId && candidate.branchId === input.branchId,
    )
    if (!level) return null
    level.lowStockAt = input.lowStockAt
    return level.lowStockAt
  })

  if (saved === null) return delayedFailure('That variant is not stocked at this branch.')
  return delay(saved)
}

/** Available quantity per variant at one branch, keyed by variant id. */
export async function getBranchStockMap(branchId: string): Promise<Record<string, number>> {
  const { branchSellableMap } = await import('@/services/stock-api.service')
  const map = await branchSellableMap(branchId)
  return delay(Object.fromEntries(map))
}
