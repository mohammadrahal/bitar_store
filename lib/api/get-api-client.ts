import { ApiError } from '@/lib/api/api-error'
import { createApi, type BitarApi } from '@/lib/api/create-api'
import { useUserStore } from '@/store/user-store'

export function createApiForUser(userId: string): BitarApi {
  return createApi(userId)
}

/** Resolves the sessionStorage user id and returns a client, or throws `ApiError` 401. */
export function getApiClient(): BitarApi {
  const userId = useUserStore.getState().userId
  if (!userId) throw new ApiError(401, 'Not signed in')
  return createApi(userId)
}
