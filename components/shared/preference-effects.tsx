'use client'

import { useEffect } from 'react'
import { resolveThemePreference, applyResolvedTheme } from '@/lib/theme'
import { useUserPreferences } from '@/hooks/use-user-preferences'
import { useUIStore } from '@/store/ui-store'
import { useSession } from '@/store/user-store'
import { isLocationScoped } from '@/lib/permissions'

/** Keeps theme, table density, and default location in sync with stored preferences. */
export function PreferenceEffects() {
  const { preferences } = useUserPreferences()
  const setTheme = useUIStore((state) => state.setTheme)
  const setActiveLocationId = useUIStore((state) => state.setActiveLocationId)
  const user = useSession()

  useEffect(() => {
    const resolved = resolveThemePreference(preferences.theme)
    setTheme(resolved)
    applyResolvedTheme(resolved)
  }, [preferences.theme, setTheme])

  useEffect(() => {
    document.documentElement.dataset.tableDensity = preferences.tableDensity
  }, [preferences.tableDensity])

  useEffect(() => {
    if (!user || !isLocationScoped(user)) return
    const ids = user.locations.map((entry) => entry.locationId)
    if (ids.length <= 1) return
    const preferred = preferences.defaultLocationId
    if (!preferred || !ids.includes(preferred)) return
    const stored = useUIStore.getState().activeLocationId
    if (!stored || !ids.includes(stored)) setActiveLocationId(preferred)
  }, [user, preferences.defaultLocationId, setActiveLocationId])

  useEffect(() => {
    if (preferences.theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => {
      const resolved = resolveThemePreference('system')
      setTheme(resolved)
      applyResolvedTheme(resolved)
    }
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [preferences.theme, setTheme])

  return null
}
