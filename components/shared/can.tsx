'use client'

import { usePermission } from '@/hooks/use-permission'
import type { Permission } from '@/lib/permissions'

/**
 * Renders children only when the current user holds `permission` at the
 * location in question — the active location unless one is named. Hiding a
 * control is for usability; the backend is the real check.
 */
export function Can({
  permission,
  locationId,
  fallback = null,
  children,
}: {
  permission: Permission
  locationId?: string
  fallback?: React.ReactNode
  children: React.ReactNode
}) {
  const { can, canAccessLocation } = usePermission()
  const allowed = can(permission, locationId) && (locationId === undefined || canAccessLocation(locationId))
  return <>{allowed ? children : fallback}</>
}
