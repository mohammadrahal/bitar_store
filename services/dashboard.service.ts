import { getApiClient } from '@/lib/api'
import type { ApiDashboardOverview } from '@/lib/api/types'
import { priceOf } from '@/lib/api/map-catalog'
import { ALL_BRANCHES, type BranchScope, type InventoryStats, type OperationsSummary } from '@/types'

const emptyMix = (): OperationsSummary['todayMix'] => ({
  cash: { sales: 0, amount: 0 },
  whish: { sales: 0, amount: 0 },
  split: { sales: 0, amount: 0, cashAmount: 0, whishAmount: 0 },
})

function mapStats(payload: ApiDashboardOverview): InventoryStats {
  const { stock, locations } = payload
  return {
    branchCount: locations.warehouses + locations.branches,
    warehouseCount: locations.warehouses,
    productCount: stock.products,
    variantCount: stock.variantsInStock + stock.outOfStock,
    inStockVariantCount: stock.variantsInStock,
    stockUnits: stock.totalUnits,
  }
}

function mapOperations(payload: ApiDashboardOverview): OperationsSummary {
  return {
    todaySales: payload.today.docs,
    todayRevenue: priceOf(payload.today.revenue),
    todayMix: emptyMix(),
  }
}

export interface DashboardOverviewBundle {
  stats: InventoryStats
  operations: OperationsSummary
  lowStock: number
  outOfStock: number
}

/** One round trip for the overview stat cards and today's revenue. */
export async function getDashboardOverview(scope: BranchScope): Promise<DashboardOverviewBundle> {
  const payload = await getApiClient().getDashboardOverview(
    scope === ALL_BRANCHES ? {} : { branchId: scope },
  )
  return {
    stats: mapStats(payload),
    operations: mapOperations(payload),
    lowStock: payload.stock.lowStock,
    outOfStock: payload.stock.outOfStock,
  }
}
