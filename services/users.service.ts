import { getApiClient } from '@/lib/api'
import type { ApiUser } from '@/lib/api'
import { DEFAULT_EMPLOYEE_PERMISSIONS, PLATFORM_SCOPE, splitByScope } from '@/lib/permission-keys'
import {
  assignmentsFor,
  clearUserAccess,
  getUserAccess,
  setGrants,
  setUserAccess,
  type StoredUserAccess,
} from '@/lib/user-access'
import { toApiRole, toRole } from '@/services/session.service'
import { useUserStore } from '@/store/user-store'
import type { LocationAssignment, Role } from '@/types'

/** An account as the app talks about it: the API's `admin` reads as `super_admin`. */
export interface StaffUser extends Omit<ApiUser, 'role'> {
  role: Role
  locations: LocationAssignment[]
}

export interface SaveUserInput {
  email: string
  fullName: string
  role: Role
  /** Required on create; blank on edit keeps the current one. */
  password?: string
  locations: LocationAssignment[]
}

function toStaffUser(user: ApiUser): StaffUser {
  return { ...user, role: toRole(user.role), locations: assignmentsFor(user.id, []) }
}

export async function listUsers(): Promise<StaffUser[]> {
  const users = await getApiClient().listUsers()
  return users.map(toStaffUser)
}

/**
 * The API has no endpoint that lists a user's locations, so the assignments
 * picked here are remembered in this browser: to prefill the form, to know
 * which grant to revoke when one is removed, and to hold the access level and
 * per-location keys the API cannot store yet.
 */
async function syncLocations(userId: string, role: Role, locations: LocationAssignment[]) {
  const api = getApiClient()
  const previous = getUserAccess(userId).locations
  const wanted = role === 'employee' ? locations : []

  for (const entry of previous) {
    if (!wanted.some((next) => next.locationId === entry.locationId)) {
      await api.revokeBranchAccess(userId, entry.locationId)
    }
  }
  for (const entry of wanted) {
    if (!previous.some((old) => old.locationId === entry.locationId)) {
      await api.grantBranchAccess(userId, entry.locationId)
    }
  }

  const kept = getUserAccess(userId).grants
  /* A catalog key is held for the business, not at a location, and `can()` only
     reads those from the `*` bucket — so the defaults have to be split the same
     way or a key like `catalog.create` would be stored where nothing looks. */
  const defaults = splitByScope(DEFAULT_EMPLOYEE_PERMISSIONS)
  const grants: StoredUserAccess['grants'] = {
    [PLATFORM_SCOPE]: kept[PLATFORM_SCOPE] ?? [...defaults.platform],
  }
  for (const entry of wanted) {
    grants[entry.locationId] = kept[entry.locationId] ?? [...defaults.perLocation]
  }
  setUserAccess(userId, { locations: wanted, grants })
}

export async function createUser(input: SaveUserInput): Promise<StaffUser> {
  const api = getApiClient()
  const user = await api.createUser({
    email: input.email,
    fullName: input.fullName,
    role: toApiRole(input.role),
  })
  if (input.password) await api.setPassword(user.id, input.password)
  await syncLocations(user.id, input.role, input.locations)
  return toStaffUser(user)
}

export async function updateUser(id: string, input: SaveUserInput): Promise<StaffUser> {
  const api = getApiClient()
  const isSelf = useUserStore.getState().user?.id === id
  /* Nobody edits their own role. */
  const user = await api.updateUser(
    id,
    isSelf
      ? { email: input.email, fullName: input.fullName }
      : { email: input.email, fullName: input.fullName, role: toApiRole(input.role) },
  )
  if (input.password) await api.setPassword(id, input.password)
  if (!isSelf) await syncLocations(id, input.role, input.locations)
  return toStaffUser(user)
}

/**
 * Accounts are never removed: history has to keep pointing at whoever rang up
 * a sale. Deactivating blocks sign-in and keeps the record, and the stored
 * access stays put so reactivating restores the same locations.
 */
export async function setUserActive(id: string, isActive: boolean): Promise<StaffUser> {
  return toStaffUser(await getApiClient().updateUser(id, { isActive }))
}

/** Drops the locally stored access for an account that no longer exists. */
export function forgetUserAccess(id: string): void {
  clearUserAccess(id)
}

export function getUserLocations(userId: string): LocationAssignment[] {
  return getUserAccess(userId).locations
}

export function getUserGrants(userId: string): Record<string, string[]> {
  return getUserAccess(userId).grants
}

export async function saveUserGrants(userId: string, grants: Record<string, string[]>): Promise<void> {
  for (const [scope, keys] of Object.entries(grants)) setGrants(userId, scope, keys)
  /* Keys live in this browser until the API can store them; nothing to call. */
  return Promise.resolve()
}

/**
 * The last door into the system. Blocking this in the UI is a courtesy — the
 * check that matters is the backend's.
 */
export function isOnlyActiveSuperAdmin(users: StaffUser[], userId: string): boolean {
  const actives = users.filter((user) => user.role === 'super_admin' && user.isActive)
  return actives.length === 1 && actives[0].id === userId
}

export async function grantBranchAccess(userId: string, branchId: string): Promise<void> {
  return getApiClient().grantBranchAccess(userId, branchId)
}

export async function revokeBranchAccess(userId: string, branchId: string): Promise<void> {
  return getApiClient().revokeBranchAccess(userId, branchId)
}
