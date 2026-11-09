'use client'

import { useMemo } from 'react'
import {
  canDispatchTransfers,
  canManageMinimums,
  canReceiveTransfers,
  canRequestTransfer,
  canSeeTransfers,
  canViewAdminWarehouseTools,
  canViewFinancialReports,
  hasApiPermission,
  type ApiPermission,
} from '@/lib/api-access'
import {
  can,
  canAccessLocation,
  canAny,
  canViewBranchSalesTelemetry,
  canViewInvoicesLedger,
  canViewNetworkSalesTelemetry,
  isLocationScoped,
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
      locationScoped: isLocationScoped(user),
      activeLocationId,
      can: (permission: Permission, locationId = activeLocationId ?? undefined) => can(user, permission, locationId),
      canAny: (rule: PermissionRule, locationId = activeLocationId ?? undefined) => canAny(user, rule, locationId),
      /** Ignores the active location: "do they hold this key anywhere?" */
      canAnywhere: (permission: Permission) => can(user, permission),
      canAccessLocation: (locationId: string) => canAccessLocation(user, locationId),
      locationAccess: (locationId: string) => locationAccess(user, locationId),
      isViewOnlyAt: (locationId: string) => isViewOnlyAt(user, locationId),
      apiCan: (permission: ApiPermission | string) => hasApiPermission(user, permission),
      canSeeTransfers: () => canSeeTransfers(user),
      canDispatchTransfers: () => canDispatchTransfers(user),
      canReceiveTransfers: () => canReceiveTransfers(user),
      canRequestTransfer: () => canRequestTransfer(user),
      canManageMinimums: () => canManageMinimums(user),
      canViewFinancialReports: () => canViewFinancialReports(user),
      canViewAdminWarehouseTools: () => canViewAdminWarehouseTools(user),
      canViewInvoicesLedger: () => canViewInvoicesLedger(user),
      canViewBranchSalesTelemetry: (locationId = activeLocationId ?? undefined) =>
        canViewBranchSalesTelemetry(user, locationId),
      canViewNetworkSalesTelemetry: () => canViewNetworkSalesTelemetry(user),
    }),
    [user, activeLocationId],
  )
}
