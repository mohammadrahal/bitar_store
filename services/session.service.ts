import { ApiError, fetchMe } from '@/lib/api'
import type { MeResponse } from '@/lib/api'
import type { User } from '@/types'

/** Names typed in lower case ("admin", "rana haddad") read as proper names; mixed case is left alone. */
function displayName(fullName: string) {
  const trimmed = fullName.trim()
  if (trimmed !== trimmed.toLowerCase()) return trimmed
  return trimmed.replace(/(^|[\s-])(\p{L})/gu, (_match, gap: string, letter: string) => gap + letter.toUpperCase())
}

export function toSessionUser({ user, permissions, branchIds, canViewCosts }: MeResponse): User {
  return {
    id: user.id,
    name: displayName(user.fullName),
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
