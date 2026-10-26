import { ApiError } from '@/lib/api/api-error'
import { createApi, type BitarApi } from '@/lib/api/create-api'
import { useUserStore } from '@/store/user-store'

/** Client for the signed-in session, or throws `ApiError` 401 when there is none. */
export function getApiClient(): BitarApi {
  const token = useUserStore.getState().token
  if (!token) throw new ApiError(401, 'Not signed in')
  return createApi(token)
}
