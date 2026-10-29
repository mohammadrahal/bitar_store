import { readPersistentJson, writePersistentJson } from '@/lib/session-storage'
import { PLATFORM_SCOPE } from '@/lib/permission-keys'
import type { LocationAccess, LocationAssignment } from '@/types'

/**
 * Who may work where, and with which keys. `GET /auth/me` returns a flat list
 * of branch ids and a flat list of permissions, so the access level per
 * location and the per-location grants are kept in this browser until the API
 * can store them. Shared across tabs and restarts.
 */
const STORAGE_KEY = 'bitar:user-access:v1'
const LEGACY_BRANCH_MAP = 'bitar:user-branch-map:v1'

export interface StoredUserAccess {
  locations: LocationAssignment[]
  /** Keys per location id, plus the platform-wide ones under `*`. */
  grants: Record<string, string[]>
}

type AccessMap = Record<string, StoredUserAccess>

const EMPTY: StoredUserAccess = { locations: [], grants: {} }

function readMap(): AccessMap {
  const map = readPersistentJson<AccessMap>(STORAGE_KEY, {})
  const legacy = readPersistentJson<Record<string, string>>(LEGACY_BRANCH_MAP, {})
  for (const [userId, locationId] of Object.entries(legacy)) {
    if (!map[userId]) map[userId] = { locations: [{ locationId, access: 'full' }], grants: {} }
  }
  return map
}

function writeMap(map: AccessMap) {
  writePersistentJson(STORAGE_KEY, map)
}

export function getUserAccess(userId: string): StoredUserAccess {
  return readMap()[userId] ?? EMPTY
}

export function setUserAccess(userId: string, access: StoredUserAccess) {
  const map = readMap()
  map[userId] = access
  writeMap(map)
}

export function clearUserAccess(userId: string) {
  const map = readMap()
  delete map[userId]
  writeMap(map)
}

/** The locations this user may work in, with the access level remembered here. */
export function assignmentsFor(userId: string, branchIds: string[]): LocationAssignment[] {
  const stored = getUserAccess(userId).locations
  const levels = new Map(stored.map((entry) => [entry.locationId, entry.access]))
  const assignments = branchIds.map((locationId) => ({
    locationId,
    access: levels.get(locationId) ?? ('full' as LocationAccess),
  }))
  /* Keep a stored assignment the API has not caught up with yet. */
  for (const entry of stored) {
    if (!branchIds.includes(entry.locationId)) assignments.push(entry)
  }
  return assignments
}

export function setLocationAccess(userId: string, locationId: string, access: LocationAccess) {
  const current = getUserAccess(userId)
  const locations = current.locations.filter((entry) => entry.locationId !== locationId)
  locations.push({ locationId, access })
  setUserAccess(userId, { ...current, locations })
}

export function removeLocation(userId: string, locationId: string) {
  const current = getUserAccess(userId)
  const { [locationId]: _dropped, ...grants } = current.grants
  setUserAccess(userId, {
    locations: current.locations.filter((entry) => entry.locationId !== locationId),
    grants,
  })
}

/** Replaces the keys held at one location, or the platform-wide set. */
export function setGrants(userId: string, scope: string, keys: string[]) {
  const current = getUserAccess(userId)
  setUserAccess(userId, { ...current, grants: { ...current.grants, [scope]: [...new Set(keys)] } })
}

export function grantsAt(userId: string, scope: string): string[] {
  return getUserAccess(userId).grants[scope] ?? []
}

export function platformGrants(userId: string): string[] {
  return grantsAt(userId, PLATFORM_SCOPE)
}
