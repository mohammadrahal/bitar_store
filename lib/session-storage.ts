/** Session-scoped browser storage (cleared when the tab closes). Used for sign-in and dev credentials. */

export function readSessionJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeSessionJson(key: string, value: unknown) {
  sessionStorage.setItem(key, JSON.stringify(value))
}

/** One-time move from localStorage after we switched session data to sessionStorage. */
export function migrateSessionKey(key: string) {
  if (typeof window === 'undefined') return
  if (sessionStorage.getItem(key) !== null) return
  const legacy = localStorage.getItem(key)
  if (!legacy) return
  sessionStorage.setItem(key, legacy)
  localStorage.removeItem(key)
}
