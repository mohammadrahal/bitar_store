import type { RequestFn } from '@/lib/api/client'
import { queryOf } from '@/lib/api/query'
import type { ApiProfitReport, ApiSkuCost, ProfitReportParams, SetSkuCostInput } from '@/lib/api/types'

/**
 * `/costs`: what a piece costs, and the profit that follows from it.
 *
 * Cost is a secret of the owners: every route here is **admin or manager by
 * role**, and no permission grant opens it to an employee. `/costs/profit` also
 * needs `reports.financial`.
 *
 * Costs come back as **four-decimal** strings (`"9.5000"`), unlike prices, which
 * carry two. Do not pass one through `priceOf`-style two-decimal formatting
 * without meaning to: a cost of `9.5000` is nine and a half, not nine thousand
 * five hundred.
 *
 * This is what the device-local `bitar:catalog-costs:v1` store was standing in
 * for. A cost set here is shared, audited (`sku.cost_set`) and feeds the supply
 * invoice price, which the local one could never do.
 */
export function createCostsApi(request: RequestFn) {
  return {
    getSkuCost: (skuId: string) => request<ApiSkuCost>(`/costs/skus/${skuId}`),

    /** `unitCost: null` clears the catalog cost and leaves the warehouse average alone. */
    setSkuCost: (skuId: string, input: SetSkuCostInput) =>
      request<ApiSkuCost>(`/costs/skus/${skuId}`, 'PUT', input),

    /** Omit `branchId` for every branch the account reaches. */
    getProfitReport: (params: ProfitReportParams = {}) =>
      request<ApiProfitReport>(`/costs/profit${queryOf({ ...params })}`),
  }
}

export type CostsApi = ReturnType<typeof createCostsApi>
