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
  'discounts.request',
  'sales.cancel',
  'returns.process',
  'refunds.issue',
  'catalog.create',
  'catalog.edit',
  'receipts.enter',
  'costs.view',
  'movements.request',
  'movements.prepare_dispatch',
  'stock.view',
  'counts.enter',
  'cash.open',
  'cash.handover',
  'cash.close',
  'cash.adjust',
  'reports.view_branch',
  'reports.export',
] as const

export const MANAGER_PERMISSIONS = [
  'locations.view_all',
  'users.manage',
  'reports.view_all',
  'discounts.apply',
  'discounts.approve',
  'refunds.approve',
  'documents.manage',
  'documents.void',
  'movements.approve',
  'movements.confirm_dispatch',
  'movements.confirm_receipt',
  'suppliers.manage',
  'receipts.confirm',
  'counts.apply',
  'holds.manage',
  'stock.correct',
  'stock.dispose',
  'thresholds.manage',
  'replenishment.review',
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

/** What a view-only assignment allows: look at the stock, change nothing. */
export const VIEW_ONLY_PERMISSIONS: readonly Permission[] = ['catalog.view', 'stock.view']

/** Copied onto a new employee at each assigned location. */
export const DEFAULT_EMPLOYEE_PERMISSIONS: readonly EmployeePermission[] = [
  'stock.view',
  'sales.create',
  'sales.view_own',
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
  'discounts.request': 'Request a discount (needs approval)',
  'sales.cancel': 'Cancel a sale they rang up',
  'returns.process': 'Process a return',
  'refunds.issue': 'Issue an approved refund',
  'catalog.create': 'Add models and variants',
  'catalog.edit': 'Edit models and variants',
  'receipts.enter': 'Enter a supplier receipt as a draft',
  'costs.view': 'See cost prices and margin',
  'movements.request': 'Request stock from another location',
  'movements.prepare_dispatch': 'Prepare a dispatch for approval',
  'stock.view': 'See stock balances',
  'counts.enter': 'Enter a physical count',
  'cash.open': 'Open the drawer',
  'cash.handover': 'Hand the drawer over',
  'cash.close': 'Close the drawer',
  'cash.adjust': 'Adjust the drawer',
  'reports.view_branch': "See the location's reports",
  'reports.export': 'Export reports',
}

/** Grouped for the editor so twenty-one toggles do not arrive as one list. */
export const PERMISSION_GROUPS: { label: string; platformWide?: boolean; keys: readonly EmployeePermission[] }[] = [
  { label: 'Till', keys: ['sales.create', 'sales.view_own', 'sales.view_branch', 'discounts.request', 'sales.cancel'] },
  { label: 'Returns', keys: ['returns.process', 'refunds.issue'] },
  { label: 'Catalog', platformWide: true, keys: ['catalog.create', 'catalog.edit'] },
  { label: 'Stock', keys: ['stock.view', 'counts.enter', 'movements.request', 'movements.prepare_dispatch'] },
  { label: 'Receiving', keys: ['receipts.enter', 'costs.view'] },
  { label: 'Cash drawer', keys: ['cash.open', 'cash.handover', 'cash.close', 'cash.adjust'] },
  { label: 'Reports', keys: ['reports.view_branch', 'reports.export'] },
]
