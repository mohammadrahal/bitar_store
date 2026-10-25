import type { UserRole } from '@/lib/api/types'
import { migrateSessionKey, readSessionJson, writeSessionJson } from '@/lib/session-storage'

/** Dev-only login records until POST /auth/login exists. Must match passwords set in the admin UI. */
export interface DevCredential {
  userId: string
  email: string
  password: string
  fullName: string
  role: UserRole
}

const STORAGE_KEY = 'bitar:dev-credentials:v1'

function ensureMigrated() {
  migrateSessionKey(STORAGE_KEY)
}

function readAll(): DevCredential[] {
  if (typeof window === 'undefined') return []
  ensureMigrated()
  const parsed = readSessionJson<DevCredential[]>(STORAGE_KEY, [])
  return Array.isArray(parsed) ? parsed : []
}

function writeAll(entries: DevCredential[]) {
  writeSessionJson(STORAGE_KEY, entries)
}

export function registerDevCredential(entry: DevCredential) {
  const normalized = entry.email.trim().toLowerCase()
  const next = readAll().filter((item) => item.userId !== entry.userId && item.email !== normalized)
  next.push({ ...entry, email: normalized })
  writeAll(next)
}

export function findDevCredential(email: string, password: string): DevCredential | undefined {
  const normalized = email.trim().toLowerCase()
  return readAll().find((item) => item.email === normalized && item.password === password)
}

export function findDevCredentialByUserId(userId: string): DevCredential | undefined {
  return readAll().find((item) => item.userId === userId)
}

export function upsertDevCredential(
  userId: string,
  profile: { email: string; fullName: string; role: UserRole },
  newPassword?: string,
) {
  const existing = findDevCredentialByUserId(userId)
  const password = newPassword?.trim() || existing?.password
  if (!password) return

  registerDevCredential({
    userId,
    email: profile.email,
    fullName: profile.fullName,
    role: profile.role,
    password,
  })
}

/** @deprecated Use upsertDevCredential */
export function syncDevCredential(userId: string, patch: Partial<Omit<DevCredential, 'userId'>>) {
  const existing = findDevCredentialByUserId(userId)
  if (!existing && !patch.password?.trim()) return
  upsertDevCredential(
    userId,
    {
      email: patch.email ?? existing?.email ?? '',
      fullName: patch.fullName ?? existing?.fullName ?? 'User',
      role: patch.role ?? existing?.role ?? 'employee',
    },
    patch.password,
  )
}
