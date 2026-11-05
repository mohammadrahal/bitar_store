import { ApiError, getApiClient } from '@/lib/api'
import { apiFeatureHint, isApiFeatureMissing, noteMissingApiFeature } from '@/lib/api/capabilities'
import type { ApiBranchAccess, ApiUser } from '@/lib/api'
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
  /** Branch ids this person may use. Managers appointed to every branch leave this empty. */
  branchIds: string[]
  /** Set for managers. `all` includes shops opened later and never the warehouse. */
  branchAccessMode?: 'all' | 'selected'
}

export interface SaveUserInput {
  email: string
  fullName: string
  role: Role
  /** Required on create; blank on edit keeps the current one. */
  password?: string
  locations: LocationAssignment[]
  /** Managers only. Employees are always `selected`. */
  branchAccess?: 'all' | 'selected'
  /** Role before this save, so leaving "all branches" happens while they are still a manager. */
  previousRole?: Role
  /** Keys whose allowed state differs from what is already saved. */
  permissionChanges?: Record<string, boolean>
}

function toStaffUser(user: ApiUser, branchIds: string[] = [], branchAccessMode?: 'all' | 'selected'): StaffUser {
  return { ...user, role: toRole(user.role), locations: assignmentsFor(user.id, branchIds), branchIds, branchAccessMode }
}

function staffUserFromLocal(user: ApiUser): StaffUser {
  const role = toRole(user.role)
  if (role === 'super_admin') return toStaffUser(user, [])

  const stored = getUserAccess(user.id)
  if (role === 'manager') {
    const mode = stored.branchAccessMode ?? 'selected'
    if (mode === 'all') return toStaffUser(user, [], 'all')
    const branchIds = stored.locations.map((entry) => entry.locationId)
    return toStaffUser(user, branchIds, 'selected')
  }

  const branchIds = stored.locations.map((entry) => entry.locationId)
  return toStaffUser(user, branchIds)
}

/** Keeps the employee list in sync after `GET /users/:id/branch-access` (edit form only). */
export function mirrorManagerBranchAccess(userId: string, access: ApiBranchAccess) {
  const current = getUserAccess(userId)
  setUserAccess(userId, {
    ...current,
    branchAccessMode: access.mode,
    locations:
      access.mode === 'all'
        ? []
        : access.branchIds.map((locationId) => ({ locationId, access: 'full' as const })),
  })
}

export async function listUsers(): Promise<StaffUser[]> {
  const users = await getApiClient().listUsers()
  return users.map(staffUserFromLocal)
}

/** Branch grants for one user from the server; view-only level is still local-only. */
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
  await loadUserAccess(userId)
}

/** Branch access for one user in this browser (updated when an admin grants or revokes). */
export async function loadUserAccess(userId: string): Promise<StoredUserAccess> {
  return getUserAccess(userId)
}

async function syncSelectedBranches(userId: string, wantedIds: string[]) {
  const api = getApiClient()
  let current: string[] = []
  try {
    current = (await api.getBranchAccess(userId)).branchIds
  } catch {
    current = getUserAccess(userId).locations.map((entry) => entry.locationId)
  }
  for (const id of current) {
    if (!wantedIds.includes(id)) await api.revokeBranchAccess(userId, id)
  }
  for (const id of wantedIds) {
    if (!current.includes(id)) await api.grantBranchAccess(userId, id)
  }
  const kept = getUserAccess(userId).grants
  setUserAccess(userId, {
    locations: wantedIds.map((locationId) => ({ locationId, access: 'full' as const })),
    grants: kept,
    branchAccessMode: 'selected',
  })
}

async function applyBranchAccess(id: string, input: SaveUserInput) {
  const api = getApiClient()
  const mode = input.branchAccess ?? 'selected'
  const branchAccessApi = !isApiFeatureMissing('branchAccess')
  if (branchAccessApi && input.previousRole === 'manager' && input.role === 'employee') {
    try {
      await api.setBranchAccess(id, 'selected')
    } catch (error) {
      noteMissingApiFeature(error, 'branchAccess')
    }
  }
  if (input.role === 'manager' && branchAccessApi) {
    try {
      await api.setBranchAccess(id, mode)
    } catch (error) {
      noteMissingApiFeature(error, 'branchAccess')
    }
    if (mode === 'all') {
      const kept = getUserAccess(id).grants
      setUserAccess(id, { locations: [], grants: kept, branchAccessMode: 'all' })
    } else {
      await syncSelectedBranches(id, input.locations.map((entry) => entry.locationId))
    }
    return
  }
  if (input.role === 'employee') await syncLocations(id, input.role, input.locations)
}

async function applyPermissionChanges(id: string, changes: Record<string, boolean> | undefined) {
  if (!changes || Object.keys(changes).length === 0) return
  if (isApiFeatureMissing('permissions')) return
  try {
    await getApiClient().setUserPermissions(id, changes)
  } catch (error) {
    noteMissingApiFeature(error, 'permissions')
    if (error instanceof ApiError && error.status !== 404) throw error
  }
}

export async function createUser(input: SaveUserInput): Promise<StaffUser> {
  const api = getApiClient()
  const user = await api.createUser({
    email: input.email,
    fullName: input.fullName,
    role: toApiRole(input.role),
  })
  if (input.password) await api.setPassword(user.id, input.password)
  await applyBranchAccess(user.id, input)
  await applyPermissionChanges(user.id, input.permissionChanges)
  const branchIds =
    input.role === 'manager' && input.branchAccess === 'all'
      ? []
      : input.role === 'super_admin'
        ? []
        : input.locations.map((entry) => entry.locationId)
  return toStaffUser(user, branchIds, input.role === 'manager' ? (input.branchAccess ?? 'selected') : undefined)
}

export async function updateUser(id: string, input: SaveUserInput): Promise<StaffUser> {
  const api = getApiClient()
  const isSelf = useUserStore.getState().user?.id === id
  /* Leave "all branches" while they are still a manager. An employee cannot be appointed to all. */
  if (!isSelf && !isApiFeatureMissing('branchAccess') && input.previousRole === 'manager' && input.role !== 'manager') {
    try {
      await api.setBranchAccess(id, 'selected')
    } catch (error) {
      noteMissingApiFeature(error, 'branchAccess')
    }
  }
  const user = await api.updateUser(
    id,
    isSelf
      ? { email: input.email, fullName: input.fullName }
      : { email: input.email, fullName: input.fullName, role: toApiRole(input.role) },
  )
  if (input.password) await api.setPassword(id, input.password)
  if (!isSelf && input.role === 'manager' && !isApiFeatureMissing('branchAccess')) {
    const mode = input.branchAccess ?? 'selected'
    try {
      await api.setBranchAccess(id, mode)
    } catch (error) {
      noteMissingApiFeature(error, 'branchAccess')
    }
    if (mode === 'all') {
      const kept = getUserAccess(id).grants
      setUserAccess(id, { locations: [], grants: kept, branchAccessMode: 'all' })
    } else {
      await syncSelectedBranches(id, input.locations.map((entry) => entry.locationId))
    }
  } else if (!isSelf && input.role === 'employee') {
    await syncLocations(id, input.role, input.locations)
  }
  if (!isSelf) await applyPermissionChanges(id, input.permissionChanges)
  const branchIds =
    input.role === 'manager' && (input.branchAccess ?? 'selected') === 'all'
      ? []
      : input.role === 'super_admin'
        ? []
        : input.role === 'employee'
          ? (await loadUserAccess(id)).locations.map((entry) => entry.locationId)
          : input.locations.map((entry) => entry.locationId)
  return toStaffUser(user, branchIds, input.role === 'manager' ? (input.branchAccess ?? 'selected') : undefined)
}

export async function deleteUserAccount(id: string): Promise<void> {
  await getApiClient().deleteUser(id)
  forgetUserAccess(id)
}

export async function getBranchAccess(userId: string): Promise<ApiBranchAccess | null> {
  if (isApiFeatureMissing('branchAccess')) return null
  try {
    const access = await getApiClient().getBranchAccess(userId)
    mirrorManagerBranchAccess(userId, access)
    return access
  } catch (error) {
    noteMissingApiFeature(error, 'branchAccess')
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export async function getPermissionCatalog() {
  if (isApiFeatureMissing('permissions')) {
    throw new Error(apiFeatureHint('permissions'))
  }
  try {
    return await getApiClient().getPermissionCatalog()
  } catch (error) {
    noteMissingApiFeature(error, 'permissions')
    throw error
  }
}

export async function getUserPermissions(userId: string) {
  if (isApiFeatureMissing('permissions')) {
    throw new Error(apiFeatureHint('permissions'))
  }
  return getApiClient().getUserPermissions(userId)
}

export async function setUserPermissions(userId: string, permissions: Record<string, boolean>) {
  return getApiClient().setUserPermissions(userId, permissions)
}

/** Deactivating blocks sign-in and can be turned back on. The stored access stays. */
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
