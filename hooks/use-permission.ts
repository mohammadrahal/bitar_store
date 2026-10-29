'use client'

import { useMemo } from 'react'
import {
  can,
  canAccessLocation,
  canAny,
  canViewCosts,
  isLocationScoped,
  isSuperAdmin,
  isViewOnlyAt,
  locationAccess,
  type Permission,
  type PermissionRule,
} from '@/lib/permissions'
import { useActiveLocationId } from '@/hooks/use-active-location'
import { useCurrentUser } from '@/store/user-store'

/**
 * Single entry point for permission checks inside components. `can` defaults
 * to the active location, so a screen asks "may this user do it here?" without
 * threading the location through every call.
 */
export function usePermission() {
  const user = useCurrentUser()
  const activeLocationId = useActiveLocationId()

  return useMemo(
    () => ({
      user,
      role: user.role,
      superAdmin: isSuperAdmin(user),
      locationScoped: isLocationScoped(user),
      activeLocationId,
      can: (permission: Permission, locationId = activeLocationId ?? undefined) => can(user, permission, locationId),
      canAny: (rule: PermissionRule, locationId = activeLocationId ?? undefined) => canAny(user, rule, locationId),
      /** Ignores the active location: "do they hold this key anywhere?" */
      canAnywhere: (permission: Permission) => can(user, permission),
      canViewCosts: canViewCosts(user),
      canAccessLocation: (locationId: string) => canAccessLocation(user, locationId),
      locationAccess: (locationId: string) => locationAccess(user, locationId),
      isViewOnlyAt: (locationId: string) => isViewOnlyAt(user, locationId),
    }),
    [user, activeLocationId],
  )
}
