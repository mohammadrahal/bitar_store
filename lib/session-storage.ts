/** Browser storage that survives closing the tab. Used for branch assignments. */
export function readPersistentJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writePersistentJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}
