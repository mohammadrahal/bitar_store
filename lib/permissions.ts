import { isEnabled } from '@/lib/features'
import {
  BASELINE_PERMISSIONS,
  MANAGER_PERMISSIONS,
  PLATFORM_SCOPE,
  SUPER_ADMIN_PERMISSIONS,
  VIEW_ONLY_PERMISSIONS,
  isPlatformPermission,
  type Permission,
} from '@/lib/permission-keys'
import type { LocationAccess, Role, User } from '@/types'

export type { Permission } from '@/lib/permission-keys'

/** A rule may accept any one of several keys, for screens two roles reach differently. */
export type PermissionRule = Permission | readonly Permission[]

function holds(set: readonly string[], permission: Permission): boolean {
  return set.includes(permission)
}

/** Which keys this employee holds at one location, including the platform-wide ones. */
function employeeKeysAt(user: User, locationId: string): readonly string[] {
  const assignment = user.locations.find((entry) => entry.locationId === locationId)
  if (!assignment) return []
  const granted = [...(user.grants[locationId] ?? []), ...(user.grants[PLATFORM_SCOPE] ?? []), ...user.permissions]
  if (assignment.access === 'view_only') {
    return granted.filter((key) => (VIEW_ONLY_PERMISSIONS as readonly string[]).includes(key))
  }
  return granted
}

/**
 * The single permission check.
 *
 * - A super admin may do everything.
 * - A manager may do every business operation, except the three keys reserved
 *   for the super admin.
 * - An employee needs the key, at the location they are working in. Leaving
 *   `locationId` out asks whether they hold it anywhere, which is what the
 *   sidebar and the route guard want; anything that writes passes the active
 *   location, which `usePermission` fills in.
 *
 * Hiding a control is for usability. The backend is the real check.
 */
export function can(user: User, permission: Permission, locationId?: string): boolean {
  if (holds(BASELINE_PERMISSIONS, permission)) return true
  if (user.role === 'super_admin') return true
  if (user.role === 'manager') return !holds(SUPER_ADMIN_PERMISSIONS, permission)

  if (holds(SUPER_ADMIN_PERMISSIONS, permission) || holds(MANAGER_PERMISSIONS, permission)) return false

  /* The API answers cost visibility with a flag of its own rather than a key. */
  if (permission === 'costs.view' && user.canViewCosts) return true

  if (isPlatformPermission(permission)) {
    return user.permissions.includes(permission) || (user.grants[PLATFORM_SCOPE] ?? []).includes(permission)
  }

  if (locationId) return employeeKeysAt(user, locationId).includes(permission)
  return user.locations.some((entry) => employeeKeysAt(user, entry.locationId).includes(permission))
}

export function canAny(user: User, rule: PermissionRule, locationId?: string): boolean {
  const list = Array.isArray(rule) ? rule : [rule]
  return list.some((permission) => can(user, permission, locationId))
}

/** Cost and margin: both owner roles, and an employee granted `costs.view`. */
export function canViewCosts(user: User): boolean {
  return can(user, 'costs.view')
}

export function isSuperAdmin(user: User): boolean {
  return user.role === 'super_admin'
}

/** Owners work at every location; only employees are tied to assignments. */
export function isLocationScoped(user: User): boolean {
  return !can(user, 'locations.view_all')
}

export function canAccessLocation(user: User, locationId: string): boolean {
  if (can(user, 'locations.view_all')) return true
  return user.locations.some((entry) => entry.locationId === locationId)
}

/** 'full', 'view_only', or null when the location is not theirs at all. */
export function locationAccess(user: User, locationId: string): LocationAccess | null {
  if (can(user, 'locations.view_all')) return 'full'
  return user.locations.find((entry) => entry.locationId === locationId)?.access ?? null
}

export function isViewOnlyAt(user: User, locationId: string): boolean {
  return locationAccess(user, locationId) === 'view_only'
}

/** The landing page: the combined overview for owners, their own location otherwise. */
export function homePathFor(user: User): string {
  if (can(user, 'locations.view_all')) return '/dashboard'
  return user.branchId ? `/branches/${user.branchId}` : '/products'
}

/** Routes behind a feature flag: hidden entirely while the flag is off. */
const FLAGGED_ROUTES: [prefix: string, flag: 'b2bSales' | 'replenishmentSuggestions'][] = [
  ['/sales/b2b', 'b2bSales'],
]

/** Path prefixes and what each one needs. Longest prefix is checked first. */
const ROUTE_PERMISSIONS: [prefix: string, rule: PermissionRule][] = [
  ['/products/new', 'catalog.create'],
  ['/sales/new', 'sales.create'],
  ['/sales/b2b', 'documents.manage'],
  ['/sales/b2c', ['sales.view_own', 'sales.view_branch']],
  ['/sales/', ['sales.view_own', 'sales.view_branch']],
  ['/transfers/new', 'movements.request'],
  ['/transfers', 'stock.view'],
  ['/inventory', 'stock.view'],
  ['/stock-control', ['counts.enter', 'counts.apply', 'holds.manage', 'stock.dispose']],
  ['/replenishment', ['movements.request', 'replenishment.review']],
  ['/receiving', ['receipts.enter', 'receipts.confirm', 'suppliers.manage']],
  ['/opening-stock', ['counts.enter', 'opening_stock.post']],
  ['/users', 'users.manage'],
  // A document's own location is only known once it loads, so /invoices/:id is
  // checked by the detail view rather than here.
  ['/invoices', 'documents.manage'],
]

/**
 * Where a user must be sent instead of `pathname`, or null when the path is
 * allowed. Employees never reach the combined overview or another location.
 */
export function redirectPathFor(user: User, pathname: string): string | null {
  const home = homePathFor(user)
  if (pathname === home) return null

  if (pathname === '/dashboard' && !can(user, 'locations.view_all')) return home
  if (pathname === '/branches' && !can(user, 'locations.view_all')) return home

  const flagged = FLAGGED_ROUTES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  if (flagged && !isEnabled(flagged[1])) return home

  const rule = ROUTE_PERMISSIONS.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  if (rule && !canAny(user, rule[1])) return home

  const locationMatch = /^\/branches\/([^/]+)/.exec(pathname)
  if (locationMatch && !canAccessLocation(user, locationMatch[1])) return home

  return null
}

/**
 * Where to land after signing in: back to the page that was asked for when the
 * user may open it, otherwise their own home. Only in-app paths are honoured,
 * so a crafted `next` cannot bounce the user off-site.
 */
export function postLoginPathFor(user: User, next: string | null): string {
  const home = homePathFor(user)
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/login')) return home
  return redirectPathFor(user, next) ?? next
}

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super admin',
  manager: 'Manager',
  employee: 'Employee',
}
