import { createApi, getApiClient } from '@/lib/api'
import type { ApiUser, CreateUserInput, UpdateUserInput, UserRole } from '@/lib/api'
import { registerDevCredential, upsertDevCredential } from '@/lib/dev-credentials'
import { clearUserBranchId, getUserBranchId, setUserBranchId } from '@/lib/user-branch-map'

export interface CreateUserWithBranchInput extends CreateUserInput {
  branchId?: string | null
}

export interface UpdateUserWithBranchInput {
  id: string
  email?: string
  password?: string
  fullName?: string
  role?: UserRole
  isActive?: boolean
  branchId?: string | null
}

export async function listUsers(): Promise<ApiUser[]> {
  return getApiClient().listUsers()
}

export async function createUser(input: CreateUserInput): Promise<ApiUser> {
  return getApiClient().createUser(input)
}

async function syncBranchAssignment(userId: string, role: UserRole, branchId: string | null | undefined) {
  if (role === 'admin') {
    const previous = getUserBranchId(userId)
    if (previous) {
      await revokeBranchAccess(userId, previous)
      clearUserBranchId(userId)
    }
    return
  }

  if (!branchId) return

  const previous = getUserBranchId(userId)
  if (previous && previous !== branchId) {
    await revokeBranchAccess(userId, previous)
  }
  await grantBranchAccess(userId, branchId)
  setUserBranchId(userId, branchId)

  const granted = await createApi(userId).listBranches()
  if (granted.length === 0) {
    throw new Error(
      'Branch access was saved but the server did not return any branches for this user. Restart the API server if you recently updated it, then try Edit user and save again.',
    )
  }
}

export async function createUserWithBranch(input: CreateUserWithBranchInput): Promise<ApiUser> {
  const { branchId, ...payload } = input
  const user = await createUser(payload)

  registerDevCredential({
    userId: user.id,
    email: user.email,
    password: payload.password,
    fullName: user.fullName,
    role: user.role,
  })

  await syncBranchAssignment(user.id, user.role, branchId ?? null)
  return user
}

export async function updateUser(id: string, changes: UpdateUserInput): Promise<ApiUser> {
  return getApiClient().updateUser(id, changes)
}

export async function updateUserWithBranch(input: UpdateUserWithBranchInput): Promise<ApiUser> {
  const { id, branchId, password, ...fields } = input
  const changes: UpdateUserInput = { ...fields }
  if (password?.trim()) changes.password = password.trim()

  const user = await updateUser(id, changes)

  upsertDevCredential(
    id,
    { email: user.email, fullName: user.fullName, role: user.role },
    password,
  )

  await syncBranchAssignment(user.id, user.role, branchId)
  return user
}

export async function setUserActive(id: string, isActive: boolean): Promise<ApiUser> {
  return updateUser(id, { isActive })
}

/** API has no DELETE /users — turning access off is the only removal. */
export async function deactivateUser(id: string): Promise<ApiUser> {
  return setUserActive(id, false)
}

/** Same as deactivateUser; use this name if the UI says “delete”. */
export async function deleteUser(id: string): Promise<ApiUser> {
  return deactivateUser(id)
}

export async function grantBranchAccess(userId: string, branchId: string): Promise<void> {
  return getApiClient().grantBranchAccess(userId, branchId)
}

export async function revokeBranchAccess(userId: string, branchId: string): Promise<void> {
  return getApiClient().revokeBranchAccess(userId, branchId)
}
