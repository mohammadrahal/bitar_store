/**
 * Every permission key in the system, named once so the backend can use the
 * same strings. Three tiers, because a key's tier is what decides who may hold
 * it:
 *
 * - `BASELINE` — implicit for anyone signed in. The API lets any authenticated
 *   caller read the catalog, so there is nothing to grant.
 * - `EMPLOYEE` — the grantable set. Granted per location, except the catalog
 *   keys, which are platform-wide.
 * - `MANAGER` — business operations an employee may never be granted
 *   (confirming dispatch, receipt or a supplier receipt, corrections, releasing
 *   holds, approving refunds and discounts, changing permissions). Every
 *   manager and super admin holds all of them.
 * - `SUPER_ADMIN` — the three keys a manager is blocked from.
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
  'cash.open',
  'cash.handover',
  'cash.close',
  'cash.adjust',
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
] as const

export const SUPER_ADMIN_PERMISSIONS = ['settings.manage', 'users.deactivate', 'users.role.change'] as const

export type BaselinePermission = (typeof BASELINE_PERMISSIONS)[number]
export type EmployeePermission = (typeof EMPLOYEE_PERMISSIONS)[number]
export type ManagerPermission = (typeof MANAGER_PERMISSIONS)[number]
export type SuperAdminPermission = (typeof SUPER_ADMIN_PERMISSIONS)[number]

export type Permission = BaselinePermission | EmployeePermission | ManagerPermission | SuperAdminPermission

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
  /* Asking is not deciding: both of these go to a manager or super admin. */
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

export function isSuperAdminOnly(permission: Permission): boolean {
  return (SUPER_ADMIN_PERMISSIONS as readonly string[]).includes(permission)
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
  'cash.handover': 'Hand the drawer over',
  'cash.close': 'Close the drawer',
  'cash.adjust': 'Adjust the drawer',
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
  'cash.handover': 'Can hand the drawer to the next person.',
  'cash.close': 'Can close the drawer at the end of the shift.',
  'cash.adjust': 'Can record a drawer adjustment.',
  'reports.view_branch': 'Can see reports for this location.',
}

/** Grouped for the editor so twenty-one toggles do not arrive as one list. */
export const PERMISSION_GROUPS: { label: string; platformWide?: boolean; keys: readonly EmployeePermission[] }[] = [
  { label: 'Till', keys: ['sales.create', 'sales.view_own', 'sales.view_branch', 'sales.cancel'] },
  { label: 'Catalog', platformWide: true, keys: ['catalog.create', 'catalog.edit'] },
  { label: 'Stock', keys: ['stock.view'] },
  { label: 'Cash drawer', keys: ['cash.open', 'cash.handover', 'cash.close', 'cash.adjust'] },
  { label: 'Reports', keys: ['reports.view_branch'] },
]
