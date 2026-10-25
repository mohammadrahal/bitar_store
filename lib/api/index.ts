export { ApiError } from '@/lib/api/api-error'
export { createApi, type BitarApi } from '@/lib/api/create-api'
export {
  createRequest,
  fetchHealth,
  getApiBaseUrl,
  loginWithApi,
  request,
  type HttpMethod,
  type LoginApiResponse,
  type RequestFn,
} from '@/lib/api/client'
export { createBranchesApi, type BranchesApi } from '@/lib/api/branches.api'
export { createSalesApi, type SalesApi } from '@/lib/api/sales.api'
export { createUsersApi, type UsersApi } from '@/lib/api/users.api'
export { createApiForUser, getApiClient } from '@/lib/api/get-api-client'
export type {
  ApiBranch,
  ApiUser,
  CreateBranchInput,
  CreateUserInput,
  HealthResponse,
  UpdateUserInput,
  UserRole,
} from '@/lib/api/types'
