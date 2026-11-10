/**
 * Every permission key in the system, named once so the backend can use the
 * same strings. **Two** tiers, because a key's tier is what decides who may
 * hold it:
 *
 * - `BASELINE`. implicit for anyone signed in. The API lets any authenticated
 *   caller read the catalog, so there is nothing to grant.
 * - `EMPLOYEE`. the grantable set. Granted per location, except the catalog
 *   keys, which are platform-wide.
 * - `MANAGER`. business operations an employee may never be granted
 *   (confirming dispatch, receipt or a supplier receipt, corrections, releasing
 *   holds, approving refunds and discounts, changing permissions). **Both owner
 *   roles hold all of them.**
 *
 * There used to be a third tier, `SUPER_ADMIN`, holding `settings.manage`,
 * `users.deactivate` and `users.role.change` — three keys a Business Manager
 * was blocked from. That put the Admin role *above* the managers, and the
 * approved rules give the owner roles equal authority with nobody above them
 * (rule 1). The three keys now sit in `MANAGER` with the rest, so the two owner
 * roles differ in name only.
 */

export const BASELINE_PERMISSIONS = ['catalog.view'] as const

export const EMPLOYEE_PERMISSIONS = [
  'sales.create',
  'sales.view_own',
  'sales.view_branch',
  'sales.cancel',
  'catalog.create',
  'catalog.edit',
  'stock.view',
  /* The four keys `GET /auth/me` sends for `/cash-sessions`. They were named
     `cash.handover` and `cash.adjust` here, which no server ever granted: the
     drawer is taken over by the person ACCEPTING it, and cash in or out is a
     movement, not an adjustment. A manager holds all four. */
  'cash.open',
  'cash.accept',
  'cash.close',
  'cash.move',
  /* The two keys `GET /auth/me` sends for `/returns`. The pair is deliberately
     uneven, and the server enforces it: `returns.create` takes goods in and
     hands a rejected return back, `returns.refund` pays the money — but
     **approving, rejecting and releasing stay with a manager** whatever is
     granted here. There is no `returns.approve` to grant. */
  'returns.create',
  'returns.refund',
  'reports.view_branch',
] as const

export const MANAGER_PERMISSIONS = [
  'locations.view_all',
  /* A line discount goes with the sale to `POST /sales`, which records who
     applied it. */
  'discounts.apply',
  'users.manage',
  'reports.view_all',
  'opening_stock.post',
  /* `POST /stock/adjustments` is the only way to change a balance once a SKU
     has been opened, and it writes a note into the audit log under the caller's
     name. That is a correction, which this tier already reserves. */
  'stock.adjust',
  /* The three keys the old super-admin tier kept to itself. An owner role that
     cannot change a setting, switch an account off or move someone between
     roles is not an equal of one that can, so they live here now. */
  'settings.manage',
  'users.deactivate',
  'users.role.change',
] as const

export type BaselinePermission = (typeof BASELINE_PERMISSIONS)[number]
export type EmployeePermission = (typeof EMPLOYEE_PERMISSIONS)[number]
export type ManagerPermission = (typeof MANAGER_PERMISSIONS)[number]

export type Permission = BaselinePermission | EmployeePermission | ManagerPermission

/** Catalog is one shared list, so these are granted once rather than per location. */
export const PLATFORM_PERMISSIONS: readonly Permission[] = ['catalog.view', 'catalog.create', 'catalog.edit']

/** Split by where a key is held, because the two are stored under different
    scopes: the catalog is one list for the business, everything else is held at
    a location. `can()` reads a platform key only from the `*` bucket. */
export function splitByScope(keys: readonly EmployeePermission[]) {
  return {
    platform: keys.filter((key) => isPlatformPermission(key)),
    perLocation: keys.filter((key) => !isPlatformPermission(key)),
  }
}

/** What a view-only assignment allows: look at the stock, change nothing. */
export const VIEW_ONLY_PERMISSIONS: readonly Permission[] = ['catalog.view', 'stock.view']

/** Copied onto a new employee: the catalog keys platform-wide, the rest at each
    assigned location. */
export const DEFAULT_EMPLOYEE_PERMISSIONS: readonly EmployeePermission[] = [
  'stock.view',
  'sales.create',
  'sales.view_own',
  /* Asking is not deciding: both of these go to an owner role. */
  /* A new model can be added from the floor. Cost needs `costs.view`, which is
     not here, so an employee fills in the sell price only. */
  'catalog.create',
]

/** Grants that are not tied to one location live under this key. */
export const PLATFORM_SCOPE = '*'

export function isPlatformPermission(permission: Permission): boolean {
  return PLATFORM_PERMISSIONS.includes(permission)
}

export function isEmployeeGrantable(permission: string): permission is EmployeePermission {
  return (EMPLOYEE_PERMISSIONS as readonly string[]).includes(permission)
}

/** A key only the owner roles hold, which no employee grant can unlock (rule 5). */
export function isManagerOnly(permission: Permission): boolean {
  return (MANAGER_PERMISSIONS as readonly string[]).includes(permission)
}

/** One short label per grantable key, for the permissions editor. */
export const PERMISSION_LABELS: Record<EmployeePermission, string> = {
  'sales.create': 'Ring up sales',
  'sales.view_own': 'See their own sales',
  'sales.view_branch': "See the location's sales",
  'sales.cancel': 'Cancel a sale they rang up',
  'catalog.create': 'Add models and variants',
  'catalog.edit': 'Edit models and variants',
  'stock.view': 'See stock balances',
  'cash.open': 'Open the drawer',
  'cash.accept': 'Take the drawer over',
  'cash.close': 'Close the drawer',
  'cash.move': 'Move cash in or out',
  'returns.create': 'Take returns in',
  'returns.refund': 'Pay refunds',
  'reports.view_branch': "See the location's reports",
}

/** Plain-language hint under each label. Never show the raw key in the UI. */
export const PERMISSION_HINTS: Record<EmployeePermission, string> = {
  'sales.create': 'Can start a till sale at this location.',
  'sales.view_own': "Can see till sales they created, not everyone else's.",
  'sales.view_branch': 'Can see every till sale at this location.',
  'sales.cancel': 'Can cancel a till sale they created.',
  'catalog.create': 'Can add models and variants to the shared catalog.',
  'catalog.edit': 'Can edit models and variants in the shared catalog.',
  'stock.view': 'Can see on-hand quantities at this location.',
  'cash.open': 'Can open the cash drawer.',
  'cash.accept': 'Can count the drawer and take it over from the last person.',
  'cash.close': 'Can close the drawer at the end of the shift.',
  'cash.move': 'Can take cash out of the drawer or put cash in, with a reason.',
  'returns.create':
    'Can take returned goods into custody and hand a rejected return back. Only a manager approves one.',
  'returns.refund':
    'Can pay the refund on a return a manager approved, in cash or by Whish.',
  'reports.view_branch': 'Can see reports for this location.',
}

/** Grouped for the editor so twenty-one toggles do not arrive as one list. */
export const PERMISSION_GROUPS: { label: string; platformWide?: boolean; keys: readonly EmployeePermission[] }[] = [
  { label: 'Till', keys: ['sales.create', 'sales.view_own', 'sales.view_branch', 'sales.cancel'] },
  { label: 'Catalog', platformWide: true, keys: ['catalog.create', 'catalog.edit'] },
  { label: 'Stock', keys: ['stock.view'] },
  { label: 'Cash drawer', keys: ['cash.open', 'cash.accept', 'cash.close', 'cash.move'] },
  { label: 'Returns', keys: ['returns.create', 'returns.refund'] },
  { label: 'Reports', keys: ['reports.view_branch'] },
]
