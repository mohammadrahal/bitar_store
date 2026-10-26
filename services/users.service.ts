import { getApiClient } from '@/lib/api'
import type { ApiUser, UpdateUserInput, UserRole } from '@/lib/api'
import { clearUserBranchId, getUserBranchId, setUserBranchId } from '@/lib/user-branch-map'
import { useUserStore } from '@/store/user-store'

export interface CreateUserWithBranchInput {
  email: string
  fullName: string
  role: UserRole
  password: string
  branchId?: string | null
}

export interface UpdateUserWithBranchInput extends UpdateUserInput {
  id: string
  password?: string
  branchId?: string | null
}

export async function listUsers(): Promise<ApiUser[]> {
  return getApiClient().listUsers()
}

/*
 * The API has no endpoint that lists a user's branches, so the branch picked
 * here is remembered in this browser to prefill the edit form and to know
 * which grant to revoke when it changes.
 */
async function syncBranchAssignment(userId: string, role: UserRole, branchId: string | null | undefined) {
  const previous = getUserBranchId(userId)

  if (role === 'admin') {
    if (previous) {
      await revokeBranchAccess(userId, previous)
      clearUserBranchId(userId)
    }
    return
  }

  if (!branchId || branchId === previous) return
  if (previous) await revokeBranchAccess(userId, previous)
  await grantBranchAccess(userId, branchId)
  setUserBranchId(userId, branchId)
}

export async function createUserWithBranch(input: CreateUserWithBranchInput): Promise<ApiUser> {
  const { branchId, password, ...payload } = input
  const api = getApiClient()
  const user = await api.createUser(payload)
  await api.setPassword(user.id, password)
  await syncBranchAssignment(user.id, user.role, branchId ?? null)
  return user
}

export async function updateUser(id: string, changes: UpdateUserInput): Promise<ApiUser> {
  return getApiClient().updateUser(id, changes)
}

export async function updateUserWithBranch(input: UpdateUserWithBranchInput): Promise<ApiUser> {
  const { id, branchId, password, ...fields } = input
  const isSelf = useUserStore.getState().user?.id === id
  /* Nobody edits their own role or switches their own account off. */
  const changes: UpdateUserInput = isSelf ? { email: fields.email, fullName: fields.fullName } : fields

  const user = await updateUser(id, changes)
  if (password) await getApiClient().setPassword(id, password)
  if (!isSelf) await syncBranchAssignment(user.id, user.role, branchId)
  return user
}

export async function setUserActive(id: string, isActive: boolean): Promise<ApiUser> {
  return updateUser(id, { isActive })
}

export async function deleteUser(id: string): Promise<void> {
  await getApiClient().deleteUser(id)
  clearUserBranchId(id)
}

export async function grantBranchAccess(userId: string, branchId: string): Promise<void> {
  return getApiClient().grantBranchAccess(userId, branchId)
}

export async function revokeBranchAccess(userId: string, branchId: string): Promise<void> {
  return getApiClient().revokeBranchAccess(userId, branchId)
}
