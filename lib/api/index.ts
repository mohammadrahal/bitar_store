export { ApiError } from '@/lib/api/api-error'
export { createApi, type BitarApi } from '@/lib/api/create-api'
export { fetchHealth, fetchMe, loginWithApi } from '@/lib/api/auth.api'
export {
  createRequest,
  getApiBaseUrl,
  onUnauthorized,
  send,
  type HttpMethod,
  type RequestFn,
} from '@/lib/api/client'
export { createBranchesApi, type BranchesApi } from '@/lib/api/branches.api'
export { createCatalogApi, type CatalogApi } from '@/lib/api/catalog.api'
export { createSalesApi, type SalesApi } from '@/lib/api/sales.api'
export { createUsersApi, type UsersApi } from '@/lib/api/users.api'
export { getApiClient } from '@/lib/api/get-api-client'
export type {
  ApiBarcode,
  ApiBranch,
  ApiPriceChange,
  ApiSku,
  ApiSkuDetail,
  ApiSkuWithStyle,
  ApiStyle,
  ApiStyleDetail,
  ApiUser,
  CatalogListParams,
  CreateSkuInput,
  CreateStyleInput,
  SkuListParams,
  UpdateSkuInput,
  UpdateStyleInput,
  CreateBranchInput,
  UpdateBranchInput,
  CreateUserInput,
  HealthResponse,
  LoginResponse,
  MeResponse,
  UpdateUserInput,
  UserRole,
} from '@/lib/api/types'
