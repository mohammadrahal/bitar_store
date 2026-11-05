import { fetchHealth, fetchMe } from '@/lib/api/auth.api'
import { createBranchesApi } from '@/lib/api/branches.api'
import { createCatalogApi } from '@/lib/api/catalog.api'
import { createCategoriesApi } from '@/lib/api/categories.api'
import { createDashboardApi } from '@/lib/api/dashboard.api'
import { createGoodsReceiptsApi } from '@/lib/api/goods-receipts.api'
import { createInvoicesApi } from '@/lib/api/invoices.api'
import { createPageRequest, createRequest, createTotalRequest } from '@/lib/api/client'
import { createReorderLevelsApi } from '@/lib/api/reorder-levels.api'
import { createReportsApi } from '@/lib/api/reports.api'
import { createSalesApi } from '@/lib/api/sales.api'
import { createStockApi } from '@/lib/api/stock.api'
import { createTransfersApi } from '@/lib/api/transfers.api'
import { createUsersApi } from '@/lib/api/users.api'

/** Typed client authenticated with one bearer token. */
export function createApi(token: string) {
  const request = createRequest(token)
  const pageRequest = createPageRequest(token)
  const totalRequest = createTotalRequest(token)

  return {
    me: () => fetchMe(token),
    ...createUsersApi(request),
    ...createBranchesApi(request),
    ...createCatalogApi(request),
    ...createCategoriesApi(request),
    ...createStockApi(request, pageRequest),
    ...createSalesApi(request, totalRequest),
    ...createReorderLevelsApi(request),
    ...createReportsApi(request),
    ...createDashboardApi(request),
    ...createTransfersApi(request, pageRequest),
    ...createGoodsReceiptsApi(request, pageRequest),
    ...createInvoicesApi(request, pageRequest, token),
    health: fetchHealth,
  }
}

export type BitarApi = ReturnType<typeof createApi>
