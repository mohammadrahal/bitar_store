'use client'

import { useCallback, useSyncExternalStore } from 'react'
import {
  defaultUserPreferences,
  getUserPreferences,
  patchUserPreferences,
  type TableDensity,
  type ThemePreference,
  type UserPreferences,
} from '@/services/user-preferences.service'

const listeners = new Set<() => void>()

/** Stable reference for SSR and the first client paint — required by useSyncExternalStore. */
const SERVER_SNAPSHOT: UserPreferences = { ...defaultUserPreferences }

let clientSnapshot: UserPreferences = SERVER_SNAPSHOT

function refreshClientSnapshot() {
  clientSnapshot = getUserPreferences()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (typeof window !== 'undefined') refreshClientSnapshot()
  return () => listeners.delete(listener)
}

function emit() {
  refreshClientSnapshot()
  listeners.forEach((listener) => listener())
}

function readSnapshot(): UserPreferences {
  return typeof window === 'undefined' ? SERVER_SNAPSHOT : clientSnapshot
}

function getServerSnapshot(): UserPreferences {
  return SERVER_SNAPSHOT
}

export function useUserPreferences() {
  const preferences = useSyncExternalStore(subscribe, readSnapshot, getServerSnapshot)

  const update = useCallback((patch: Partial<UserPreferences>) => {
    patchUserPreferences(patch)
    emit()
  }, [])

  return { preferences, update }
}

export function useSetThemePreference() {
  const { update } = useUserPreferences()
  return (theme: ThemePreference) => update({ theme })
}

export function useSetTableDensity() {
  const { update } = useUserPreferences()
  return (tableDensity: TableDensity) => update({ tableDensity })
}
