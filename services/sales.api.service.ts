import { getApiClient } from '@/lib/api'
import { ALL_BRANCHES, type BranchScope, type SalesAnalytics } from '@/types'

/**
 * Product sales from the real API when `/analytics/product-sales` ships.
 * Until then, keep using analytics.service (mock ledger).
 */
export async function getProductSalesFromApi(scope: BranchScope = ALL_BRANCHES): Promise<SalesAnalytics> {
  return getApiClient().getProductSales(scope)
}
