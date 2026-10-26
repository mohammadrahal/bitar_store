import { readPersistentJson, writePersistentJson } from '@/lib/session-storage'

/** Tracks the branch assigned in the app, kept in this browser across tabs and restarts. */
const STORAGE_KEY = 'bitar:user-branch-map:v1'

function readMap(): Record<string, string> {
  return readPersistentJson<Record<string, string>>(STORAGE_KEY, {})
}

function writeMap(map: Record<string, string>) {
  writePersistentJson(STORAGE_KEY, map)
}

export function getUserBranchId(userId: string): string | undefined {
  return readMap()[userId]
}

export function setUserBranchId(userId: string, branchId: string) {
  const map = readMap()
  map[userId] = branchId
  writeMap(map)
}

export function clearUserBranchId(userId: string) {
  const map = readMap()
  delete map[userId]
  writeMap(map)
}
