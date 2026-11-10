import {
  canDispatchTransfers,
  canManageMinimums,
  canReceiveTransfers,
  canRequestTransfer,
  canSeeTransfers,
  canViewAdminWarehouseTools,
  canViewFinancialReports,
} from '@/lib/api-access'
import { isBranchId } from '@/lib/branch-slug'
import {
  BASELINE_PERMISSIONS,
  MANAGER_PERMISSIONS,
  PLATFORM_SCOPE,
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
 * - **The two owner roles are equal** (rule 1). Admin and Business Manager both
 *   do everything; there is no tier above either of them. The manager used to
 *   be blocked from `settings.manage`, `users.deactivate` and
 *   `users.role.change`, which made the Admin a fourth tier the rules do not
 *   have.
 * - An employee needs the key, at the location they are working in. Leaving
 *   `locationId` out asks whether they hold it anywhere, which is what the
 *   sidebar and the route guard want; anything that writes passes the active
 *   location, which `usePermission` fills in.
 *
 * Hiding a control is for usability. The backend is the real check.
 */
export function can(user: User, permission: Permission, locationId?: string): boolean {
  if (holds(BASELINE_PERMISSIONS, permission)) return true
  if (user.role === 'super_admin' || user.role === 'manager') return true

  /* Rule 5: a manager-tier key is never reachable by an employee grant. */
  if (holds(MANAGER_PERMISSIONS, permission)) return false

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

/* `isSuperAdmin` is gone on purpose. Every caller used it to unlock something a
   Business Manager was not trusted with, which is the hierarchy rule 1 rules
   out. Gate on the key instead — both owner roles hold all of them — and read
   `role` from `usePermission` when the role itself is the question, such as
   labelling a row. */

/**
 * Admin and Business Manager, the two roles with equal authority over the
 * business (rule 1). Asked wherever a screen treats "an owner" differently from
 * an employee — such as the permission editor, which has nothing to offer
 * someone who already holds every key.
 */
export function isOwnerRole(role: Role): boolean {
  return role === 'super_admin' || role === 'manager'
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

/** At least one admin tab is available (used for `/admin`). */
export function canAccessAdminHub(user: User): boolean {
  return (
    can(user, 'users.manage') ||
    can(user, 'locations.view_all') ||
    can(user, 'opening_stock.post') ||
    canViewFinancialReports(user) ||
    canViewAdminWarehouseTools(user) ||
    can(user, 'settings.manage') ||
    can(user, 'stock.adjust')
  )
}

/**
 * Fiscal invoices ledger. Issuing from a till (`/sales/invoices/new`) stays on
 * `sales.create`; browsing the registry is for owners and financial roles.
 */
export function canViewInvoicesLedger(user: User): boolean {
  return canViewFinancialReports(user) || can(user, 'locations.view_all')
}

/**
 * Branch-wide till telemetry on the overview: today's shop sales, best sellers,
 * revenue charts. `sales.view_own` is not enough; that is what history is for.
 */
export function canViewBranchSalesTelemetry(user: User, locationId?: string): boolean {
  if (canViewFinancialReports(user)) return true
  if (can(user, 'locations.view_all')) return true
  if (locationId) return can(user, 'sales.view_branch', locationId)
  return can(user, 'sales.view_branch')
}

/**
 * Branch overview KPI for today's revenue and sale count. Any till role at that
 * location qualifies; `sales.view_branch` is not required.
 */
export function canViewTodayShopKpi(user: User, locationId: string): boolean {
  if (canViewBranchSalesTelemetry(user, locationId)) return true
  return canAny(user, ['sales.view_own', 'sales.view_branch', 'sales.create'], locationId)
}

/** Network overview sales bands (`scope` is all branches). */
export function canViewNetworkSalesTelemetry(user: User): boolean {
  return canViewFinancialReports(user) || can(user, 'locations.view_all')
}

/** The landing page: the combined overview for owners, their own location otherwise. */
export function homePathFor(user: User): string {
  if (can(user, 'locations.view_all')) return '/dashboard'
  return user.branchId ? `/branches/${user.branchId}` : '/products'
}

/** Routes behind a feature flag: hidden entirely while the flag is off. */
const FLAGGED_ROUTES: [prefix: string, flag: 'b2bSales' | 'replenishmentSuggestions'][] = [
]

/** Path prefixes and what each one needs. Longest prefix is checked first. */
const ROUTE_PERMISSIONS: [prefix: string, rule: PermissionRule][] = [
  ['/categories', 'catalog.create'],
  ['/products/new', 'catalog.create'],
  ['/sales/new', 'sales.create'],
  ['/sales/invoices/new', 'sales.create'],
  ['/sales/b2c', ['sales.view_own', 'sales.view_branch']],
  ['/sales/b2b', 'locations.view_all'],
  ['/sales/', ['sales.view_own', 'sales.view_branch']],
  /* Any one of the four drawer keys gets in: a cashier who may only open it
     still needs the screen, and the panels inside check their own key. */
  ['/cash', ['cash.open', 'cash.accept', 'cash.close', 'cash.move']],
  /* Either returns key gets in, and a manager holds both by role. The decision
     panels inside check the role separately, since approving and releasing are
     a manager's and have no key to grant. */
  ['/returns', ['returns.create', 'returns.refund']],
  ['/inventory', 'stock.view'],
  ['/opening-stock', 'opening_stock.post'],
  ['/stock-receipts', 'stock.adjust'],
  ['/suppliers', 'stock.adjust'],
  ['/users', 'users.manage'],
  ['/settings', 'settings.manage'],
]

const API_ROUTE_ACCESS: [prefix: string, allowed: (user: User) => boolean][] = [
  ['/transfers/new', canRequestTransfer],
  ['/transfers', canSeeTransfers],
  ['/replenishment', canManageMinimums],
  ['/reorder-levels', canManageMinimums],
  ['/stock-network', canViewAdminWarehouseTools],
  ['/reports', canViewFinancialReports],
  ['/audit', canViewAdminWarehouseTools],
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

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (!canAccessAdminHub(user)) return home
  }

  if (pathname.startsWith('/sales/invoices')) {
    const creating = pathname === '/sales/invoices/new' || pathname.startsWith('/sales/invoices/new/')
    if (creating) {
      if (!can(user, 'sales.create')) return home
    } else {
      const invoiceDetail = /^\/sales\/invoices\/[^/]+$/.test(pathname)
      /* `transfers.receive` and `transfers.dispatch` are *server* keys, so they
         go through api-access and not `can()`, whose list is the local grantable
         one. */
      const mayOpenDetail =
        canViewInvoicesLedger(user) || canReceiveTransfers(user) || canDispatchTransfers(user)
      if (invoiceDetail) {
        if (!mayOpenDetail) return home
      } else if (!canViewInvoicesLedger(user)) {
        return home
      }
    }
  }

  if (pathname.startsWith('/users/')) {
    const profileId = pathname.slice('/users/'.length).split('/')[0]
    if (profileId !== user.id && !can(user, 'users.manage')) return home
  } else {
    const rule = ROUTE_PERMISSIONS.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    if (rule && !canAny(user, rule[1])) return home
  }

  const apiRule = API_ROUTE_ACCESS.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  if (apiRule && !apiRule[1](user)) return home

  /* A branch page is addressed by its store code, which only the branch list
     can resolve, so the check here covers the id form and BranchGuard does the
     rest once the list has loaded. */
  const locationMatch = /^\/branches\/([^/]+)/.exec(pathname)
  if (locationMatch && isBranchId(locationMatch[1]) && !canAccessLocation(user, locationMatch[1])) return home

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

/**
 * The three roles the rules name. `super_admin` is the stored id for the API's
 * `admin` and is deliberately **not** renamed: on a cold start the cached
 * session is trusted until `GET /auth/me` answers, and offline it is trusted
 * for the whole visit, so a role id this build no longer recognised would strip
 * an owner of every permission until the network came back. The id is internal;
 * the label is what anyone reads, and it no longer claims a rank.
 */
export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Admin',
  manager: 'Business manager',
  employee: 'Employee',
}
