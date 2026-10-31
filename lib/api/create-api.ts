import { fetchHealth } from '@/lib/api/auth.api'
import { createBranchesApi } from '@/lib/api/branches.api'
import { createCatalogApi } from '@/lib/api/catalog.api'
import { createRequest } from '@/lib/api/client'
import { createReorderLevelsApi } from '@/lib/api/reorder-levels.api'
import { createReportsApi } from '@/lib/api/reports.api'
import { createSalesApi } from '@/lib/api/sales.api'
import { createStockApi } from '@/lib/api/stock.api'
import { createUsersApi } from '@/lib/api/users.api'

/** Typed client authenticated with one bearer token. */
export function createApi(token: string) {
  const request = createRequest(token)

  return {
    ...createUsersApi(request),
    ...createBranchesApi(request),
    ...createCatalogApi(request),
    ...createStockApi(request),
    ...createSalesApi(request),
    ...createReorderLevelsApi(request),
    ...createReportsApi(request),
    health: fetchHealth,
  }
}

export type BitarApi = ReturnType<typeof createApi>
