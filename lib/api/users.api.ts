import type { RequestFn } from '@/lib/api/client'
import type { ApiUser, CreateUserInput, UpdateUserInput } from '@/lib/api/types'

export function createUsersApi(request: RequestFn) {
  return {
    listUsers: () => request<ApiUser[]>('/users'),
    createUser: (input: CreateUserInput) => request<ApiUser>('/users', 'POST', input),
    updateUser: (id: string, changes: UpdateUserInput) => request<ApiUser>(`/users/${id}`, 'PATCH', changes),
    grantBranchAccess: (userId: string, branchId: string) =>
      request<void>(`/users/${userId}/branches/${branchId}`, 'PUT'),
    revokeBranchAccess: (userId: string, branchId: string) =>
      request<void>(`/users/${userId}/branches/${branchId}`, 'DELETE'),
  }
}

export type UsersApi = ReturnType<typeof createUsersApi>
