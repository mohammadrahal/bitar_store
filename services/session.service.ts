import { ApiError, fetchMe } from '@/lib/api'
import { refreshApiCapabilities } from '@/lib/api/capabilities'
import type { MeResponse, UserRole } from '@/lib/api'
import { assignmentsFromBranchIds, getUserAccess, mirrorSessionBranchAccess } from '@/lib/user-access'
import type { Role, User } from '@/types'

/** Names typed in lower case ("admin", "rana haddad") read as proper names; mixed case is left alone. */
function displayName(fullName: string) {
  const trimmed = fullName.trim()
  if (trimmed !== trimmed.toLowerCase()) return trimmed
  return trimmed.replace(/(^|[\s-])(\p{L})/gu, (_match, gap: string, letter: string) => gap + letter.toUpperCase())
}

/**
 * The one place the API's role vocabulary is translated. The backend says
 * `admin`; the app stores that role as `super_admin`.
 *
 * The stored id is a historical name, not a rank: Admin and Business Manager
 * have equal authority (rule 1) and `can()` treats them identically. It is kept
 * because a cold start trusts the cached session until `GET /auth/me` answers —
 * and offline, for the whole visit — so an id this build did not recognise
 * would strip an owner of every permission. `ROLE_LABELS` carries the name
 * people actually see.
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
  mirrorSessionBranchAccess(user.id, branchIds)
  const locations = assignmentsFromBranchIds(branchIds)
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

/* React runs mount effects twice in development, and the session is restored
   from one. Concurrent callers share the request rather than sending
   `GET /auth/me` once each. Cleared as soon as it settles, so this is
   deduplication and not a cache: the next call still reads the server. */
let inFlight: { token: string; promise: Promise<User> } | null = null

async function readSession(token: string): Promise<User> {
  const me = await fetchMe(token)
  if (!me.user.isActive) throw new ApiError(401, 'This account has been deactivated.')
  await refreshApiCapabilities(token, me.user.id)
  return toSessionUser(me)
}

/**
 * Loads the access context for a token. Call after login and when restoring a
 * session. Pass `fresh` right after writing to the account, so the read cannot
 * be answered by a request that was already on its way.
 */
export function bootstrapSession(token: string, { fresh = false } = {}): Promise<User> {
  if (!fresh && inFlight?.token === token) return inFlight.promise

  const promise = readSession(token).finally(() => {
    if (inFlight?.promise === promise) inFlight = null
  })
  inFlight = { token, promise }
  return promise
}
