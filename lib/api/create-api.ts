import { fetchHealth } from '@/lib/api/auth.api'
import { createBranchesApi } from '@/lib/api/branches.api'
import { createCatalogApi } from '@/lib/api/catalog.api'
import { createRequest } from '@/lib/api/client'
import { createSalesApi } from '@/lib/api/sales.api'
import { createUsersApi } from '@/lib/api/users.api'

/** Typed client authenticated with one bearer token. */
export function createApi(token: string) {
  const request = createRequest(token)

  return {
    ...createUsersApi(request),
    ...createBranchesApi(request),
    ...createCatalogApi(request),
    ...createSalesApi(request),
    health: fetchHealth,
  }
}

export type BitarApi = ReturnType<typeof createApi>
