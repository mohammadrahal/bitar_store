import { migrateSessionKey, readSessionJson, writeSessionJson } from '@/lib/session-storage'

/** Tracks the branch assigned in the app for the current browser session. */
const STORAGE_KEY = 'bitar:user-branch-map:v1'

function ensureMigrated() {
  migrateSessionKey(STORAGE_KEY)
}

function readMap(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  ensureMigrated()
  return readSessionJson<Record<string, string>>(STORAGE_KEY, {})
}

function writeMap(map: Record<string, string>) {
  writeSessionJson(STORAGE_KEY, map)
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
