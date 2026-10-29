import { ApiError, fetchMe } from '@/lib/api'
import type { MeResponse, UserRole } from '@/lib/api'
import { assignmentsFor, getUserAccess } from '@/lib/user-access'
import type { Role, User } from '@/types'

/** Names typed in lower case ("admin", "rana haddad") read as proper names; mixed case is left alone. */
function displayName(fullName: string) {
  const trimmed = fullName.trim()
  if (trimmed !== trimmed.toLowerCase()) return trimmed
  return trimmed.replace(/(^|[\s-])(\p{L})/gu, (_match, gap: string, letter: string) => gap + letter.toUpperCase())
}

/**
 * The one place the API's role vocabulary is translated. The backend still
 * says `admin` for the owner who may change settings, roles and accounts; the
 * app calls that role `super_admin` everywhere else.
 */
export function toRole(role: UserRole): Role {
  return role === 'admin' ? 'super_admin' : role
}

/** The reverse, for writing a role back through `POST`/`PATCH /users`. */
export function toApiRole(role: Role): UserRole {
  return role === 'super_admin' ? 'admin' : role
}

export function toSessionUser({ user, permissions, branchIds, canViewCosts }: MeResponse): User {
  const role = toRole(user.role)
  const locations = assignmentsFor(user.id, branchIds)
  return {
    id: user.id,
    name: displayName(user.fullName),
    email: user.email,
    role,
    branchId: role === 'employee' ? (locations[0]?.locationId ?? null) : null,
    branchIds,
    locations,
    permissions,
    grants: getUserAccess(user.id).grants,
    canViewCosts,
  }
}

/** Loads the access context for a token. Call after login and when restoring a session. */
export async function bootstrapSession(token: string): Promise<User> {
  const me = await fetchMe(token)
  if (!me.user.isActive) throw new ApiError(401, 'This account has been deactivated.')
  return toSessionUser(me)
}
