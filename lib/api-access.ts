import type { User } from '@/types'

/**
 * Permission strings returned by `GET /auth/me`.
 *
 * The server's whole list, which is also the database's CHECK constraint. Two
 * things it does **not** contain, and no screen should wait for:
 *
 * - **`costs.view`.** Seeing a cost depends on the role alone — admin or
 *   manager — and is never granted or revoked. `useCanViewCosts` is the gate.
 * - **`returns.approve`.** Approving, rejecting and releasing a return are a
 *   manager's acts by role; `returns.create` and `returns.refund` are the only
 *   two returns keys that can be granted.
 */
export type ApiPermission =
  | 'adjustments.create'
  | 'cash.accept'
  | 'cash.close'
  | 'cash.move'
  | 'cash.open'
  | 'catalog.create'
  | 'discounts.apply'
  | 'reports.financial'
  | 'returns.create'
  | 'returns.refund'
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

/* ------------------------------ returns ------------------------------ */

/** Take goods back into custody, and hand a rejected return to the customer. */
export function canRecordReturns(user: User): boolean {
  return hasApiPermission(user, 'returns.create')
}

/** Pay the refund on an approved return. A manager holds this by default. */
export function canRefundReturns(user: User): boolean {
  return hasApiPermission(user, 'returns.refund')
}

/**
 * Approve, reject or release a return.
 *
 * **By role, not by permission.** The API reserves these three for managers and
 * admins, and there is no key to grant: an employee with `returns.create` can
 * take the goods in and gets a 403 on the decision. Showing them the approve
 * button would promise something the server refuses.
 */
export function canDecideReturns(user: User): boolean {
  return user.role !== 'employee'
}

/** Anyone with a returns key sees the returns list; a manager sees it by role. */
export function canSeeReturns(user: User): boolean {
  return canDecideReturns(user) || canRecordReturns(user) || canRefundReturns(user)
}

/* ------------------------------- costs ------------------------------- */

/**
 * See or set what a piece cost, and read `/costs/profit`.
 *
 * Like the returns decisions, this is **role-only**: `costs.view` is
 * deliberately absent from the server's permission list, so cost visibility
 * cannot be granted to an employee or taken from a manager.
 */
export function canViewCosts(user: User): boolean {
  return user.role !== 'employee'
}
