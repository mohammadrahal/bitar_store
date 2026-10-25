import type { RequestFn } from '@/lib/api/client'
import { ALL_BRANCHES, type BranchScope, type SalesAnalytics } from '@/types'

function salesQuery(scope: BranchScope): string {
  if (scope === ALL_BRANCHES) return ''
  const params = new URLSearchParams({ branchId: scope })
  return `?${params.toString()}`
}

/**
 * Product sales analytics. The backend has not shipped this route yet (see API_GUIDE.md §9).
 * Wire `analytics.service` here when it does; until then calls will 404.
 */
export function createSalesApi(request: RequestFn) {
  return {
    getProductSales: (scope: BranchScope = ALL_BRANCHES) =>
      request<SalesAnalytics>(`/analytics/product-sales${salesQuery(scope)}`),
  }
}

export type SalesApi = ReturnType<typeof createSalesApi>
