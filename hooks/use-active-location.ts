'use client'

import { isLocationScoped } from '@/lib/permissions'
import { useUIStore } from '@/store/ui-store'
import { useSession } from '@/store/user-store'

/**
 * The location an employee is working in. One assignment needs no choice; more
 * than one has to be picked before anything is recorded, so this answers null
 * until it is. The owner roles work at every location and are never tied to
 * one, so they get null too and screens fall back to the location in view.
 */
export function useActiveLocationId(): string | null {
  const user = useSession()
  const stored = useUIStore((state) => state.activeLocationId)
  if (!user || !isLocationScoped(user)) return null

  const ids = user.locations.map((entry) => entry.locationId)
  if (ids.length === 0) return null
  if (ids.length === 1) return ids[0]
  return stored && ids.includes(stored) ? stored : null
}

/** True while an employee still has to choose which location they are at. */
export function useNeedsActiveLocation(): boolean {
  const user = useSession()
  const active = useActiveLocationId()
  if (!user || !isLocationScoped(user)) return false
  return user.locations.length > 1 && active === null
}
