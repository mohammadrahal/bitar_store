import { readPersistentJson, writePersistentJson } from '@/lib/session-storage'

export type ThemePreference = 'light' | 'dark' | 'system'
export type TableDensity = 'comfortable' | 'compact'

export interface UserPreferences {
  theme: ThemePreference
  /** Applied on sign-in when the user may pick among several locations. */
  defaultLocationId: string | null
  tableDensity: TableDensity
}

const STORAGE_KEY = 'bitar:user-preferences:v1'

export const defaultUserPreferences: UserPreferences = {
  theme: 'system',
  defaultLocationId: null,
  tableDensity: 'comfortable',
}

export function getUserPreferences(): UserPreferences {
  const stored = readPersistentJson<Partial<UserPreferences>>(STORAGE_KEY, {})
  return {
    theme: stored.theme === 'light' || stored.theme === 'dark' || stored.theme === 'system' ? stored.theme : defaultUserPreferences.theme,
    defaultLocationId: typeof stored.defaultLocationId === 'string' ? stored.defaultLocationId : null,
    tableDensity: stored.tableDensity === 'compact' ? 'compact' : 'comfortable',
  }
}

export function saveUserPreferences(next: UserPreferences) {
  writePersistentJson(STORAGE_KEY, next)
}

export function patchUserPreferences(patch: Partial<UserPreferences>): UserPreferences {
  const merged = { ...getUserPreferences(), ...patch }
  saveUserPreferences(merged)
  return merged
}
