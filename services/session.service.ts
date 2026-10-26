import { ApiError, fetchMe } from '@/lib/api'
import type { MeResponse } from '@/lib/api'
import type { User } from '@/types'

export function toSessionUser({ user, permissions, branchIds, canViewCosts }: MeResponse): User {
  return {
    id: user.id,
    name: user.fullName,
    email: user.email,
    role: user.role,
    branchId: user.role === 'admin' ? null : (branchIds[0] ?? null),
    branchIds,
    permissions,
    canViewCosts,
  }
}

/** Loads the access context for a token. Call after login and when restoring a session. */
export async function bootstrapSession(token: string): Promise<User> {
  const me = await fetchMe(token)
  if (!me.user.isActive) throw new ApiError(401, 'This account has been deactivated.')
  return toSessionUser(me)
}
