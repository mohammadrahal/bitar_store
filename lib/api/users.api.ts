import type { RequestFn } from '@/lib/api/client'
import type {
  ApiBranchAccess,
  ApiPermissionCatalog,
  ApiUser,
  ApiUserPermissions,
  CreateUserInput,
  UpdateUserInput,
} from '@/lib/api/types'

export function createUsersApi(request: RequestFn) {
  return {
    listUsers: () => request<ApiUser[]>('/users'),
    createUser: (input: CreateUserInput) => request<ApiUser>('/users', 'POST', input),
    updateUser: (id: string, changes: UpdateUserInput) => request<ApiUser>(`/users/${id}`, 'PATCH', changes),
    setPassword: (id: string, password: string) => request<void>(`/users/${id}/password`, 'PUT', { password }),
    /* Soft delete: the user leaves the list and cannot sign in; sales they
       rang up keep their name. 409 for yourself and for the last active admin. */
    deleteUser: (id: string) => request<void>(`/users/${id}`, 'DELETE'),
    grantBranchAccess: (userId: string, branchId: string) =>
      request<void>(`/users/${userId}/branches/${branchId}`, 'PUT'),
    revokeBranchAccess: (userId: string, branchId: string) =>
      request<void>(`/users/${userId}/branches/${branchId}`, 'DELETE'),
    getPermissionCatalog: () => request<ApiPermissionCatalog>('/permissions'),
    getUserPermissions: (id: string) => request<ApiUserPermissions>(`/users/${id}/permissions`),
    setUserPermissions: (id: string, permissions: Record<string, boolean>) =>
      request<ApiUserPermissions>(`/users/${id}/permissions`, 'PUT', { permissions }),
    getBranchAccess: (id: string) => request<ApiBranchAccess>(`/users/${id}/branch-access`),
    setBranchAccess: (id: string, mode: 'all' | 'selected') =>
      request<ApiBranchAccess>(`/users/${id}/branch-access`, 'PUT', { mode }),
  }
}

export type UsersApi = ReturnType<typeof createUsersApi>
