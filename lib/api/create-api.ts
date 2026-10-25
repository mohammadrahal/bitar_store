import { createBranchesApi } from '@/lib/api/branches.api'
import { createRequest, fetchHealth } from '@/lib/api/client'
import { createSalesApi } from '@/lib/api/sales.api'
import { createUsersApi } from '@/lib/api/users.api'

/** Typed client for one signed-in user (dev: `X-User-Id`, later: bearer token). */
export function createApi(userId: string) {
  const request = createRequest(userId)

  return {
    ...createUsersApi(request),
    ...createBranchesApi(request),
    ...createSalesApi(request),
    health: fetchHealth,
  }
}

export type BitarApi = ReturnType<typeof createApi>
