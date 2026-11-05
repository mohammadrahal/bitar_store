import type { User } from '@/types'

/** Permission strings returned by `GET /auth/me`. */
export type ApiPermission =
  | 'adjustments.create'
  | 'catalog.create'
  | 'discounts.apply'
  | 'reports.financial'
  | 'returns.create'
  | 'sales.create'
  | 'transfers.dispatch'
  | 'transfers.receive'
  | 'users.administer'

export function hasApiPermission(user: User, permission: ApiPermission | string): boolean {
  if (user.role === 'super_admin') return true
  return user.permissions.includes(permission)
}

/** `GET /stock/overview` and `GET /audit-events` (admin only on the server). */
export function canViewAdminWarehouseTools(user: User): boolean {
  return user.role === 'super_admin'
}

/** Prepare, send, cancel, and confirm loss. The API reserves this for managers and admins even if the permission is toggled on an employee. */
export function canDispatchTransfers(user: User): boolean {
  if (user.role === 'employee') return false
  return hasApiPermission(user, 'transfers.dispatch')
}

export function canReceiveTransfers(user: User): boolean {
  return hasApiPermission(user, 'transfers.receive')
}

export function canSeeTransfers(user: User): boolean {
  return canDispatchTransfers(user) || canReceiveTransfers(user)
}

/** Open the request/prepare form: dispatchers prepare any route; branch staff request replenishment when low. */
export function canRequestTransfer(user: User): boolean {
  if (canDispatchTransfers(user)) return true
  return canReceiveTransfers(user) && user.branchIds.length > 0
}

export function canManageMinimums(user: User): boolean {
  return hasApiPermission(user, 'adjustments.create')
}

export function canViewFinancialReports(user: User): boolean {
  return hasApiPermission(user, 'reports.financial')
}
