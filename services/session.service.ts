import { ApiError, createApi } from '@/lib/api'
import { findDevCredentialByUserId } from '@/lib/dev-credentials'
import { getUserBranchId } from '@/lib/user-branch-map'
import type { Role, User } from '@/types'

function fallbackProfile(userId: string): { fullName: string; role: Role } {
  const dev = findDevCredentialByUserId(userId)
  if (dev) return { fullName: dev.fullName, role: dev.role }
  return { fullName: 'User', role: 'employee' }
}

/**
 * Loads role and branch scope from the API using the dev identity header.
 * Admins see every branch and get branchId null; others get their granted branch.
 */
export async function bootstrapSession(userId: string): Promise<User> {
  const api = createApi(userId)
  const branches = await api.listBranches()

  let apiSelf = null
  try {
    const users = await api.listUsers()
    apiSelf = users.find((candidate) => candidate.id === userId) ?? null
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 403)) throw error
  }

  const fallback = fallbackProfile(userId)
  const role = (apiSelf?.role ?? fallback.role) as Role
  const name = apiSelf?.fullName ?? fallback.fullName
  const isAdmin = role === 'admin'

  const activeBranch = branches.find((branch) => branch.isActive) ?? branches[0]
  let branchId = isAdmin ? null : (activeBranch?.id ?? null)
  if (!isAdmin && !branchId) {
    branchId = getUserBranchId(userId) ?? null
  }

  return { id: userId, name, role, branchId }
}
