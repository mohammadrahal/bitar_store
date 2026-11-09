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

/**
 * What the **server** says this account may call, from `GET /auth/me`.
 *
 * The `super_admin` shortcut is not a UI rank: the API grants its `admin` role
 * everything implicitly and lists a manager's keys explicitly, so this mirrors
 * the server rather than deciding anything. Treating a manager as holding every
 * key here would show controls the server then refuses, which is worse than
 * hiding one it would have allowed.
 */
export function hasApiPermission(user: User, permission: ApiPermission | string): boolean {
  if (user.role === 'super_admin') return true
  return user.permissions.includes(permission)
}

/**
 * `GET /stock/overview` and `GET /audit-events`.
 *
 * **This is the server's restriction, not the app's.** `API_GUIDE.md` has both
 * as admin-only and `/stock/overview` answers a manager `403` outright. The two
 * owner roles are otherwise equal (rule 1) and `can()` makes no distinction —
 * so do not "level" this one to match: it would route a Business Manager to a
 * screen that errors. It is the last place in the frontend where the two owner
 * roles differ, and it closes when the backend widens those two reads.
 */
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
