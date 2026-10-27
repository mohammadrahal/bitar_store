import type { Role, User } from '@/types'

export const ACTIONS = [
  /** List and create staff accounts (admin). */
  'users:manage',
  /** Reach the branches management page. */
  'branches:manage',
  /** View a single branch's detail page (still limited to branches the user can access). */
  'branches:read',
  'branches:create',
  'branches:edit',
  'branches:delete',
  /** See data across every branch rather than just one. */
  'branches:view-all',
  /** Mark which location is the main warehouse. */
  'locations:set-warehouse',
  'products:read',
  'products:create',
  'products:edit',
  /** Archive a model so it leaves sale and transfer pickers, or bring it back. */
  'products:archive',
  /** Set a variant's low-stock threshold at a branch. */
  'stock:manage',
  /** See cost price and margin. */
  'products:read-cost',
  /** Five balances per variant and per location. */
  'inventory:read',
  'transfers:read',
  'transfers:request',
  /** Approve (reserves stock), reduce or cancel before dispatch. */
  'transfers:approve',
  'transfers:dispatch',
  'transfers:receive',
  /** Place and release holds. */
  'stock:hold',
  /** Apply a physical count as a correction. */
  'stock:count',
  /** Report a count difference for a manager to resolve. */
  'stock:report',
  /** Write off stock with a reason. */
  'stock:dispose',
  'replenishment:read',
  'invoices:read',
  'invoices:create',
  /** Rewrite or throw away a draft. */
  'invoices:edit',
  /** Post a draft, which moves stock. */
  'invoices:issue',
  /** Reverse a posted document. Admin only: it gives stock back. */
  'invoices:void',
  /** See unit cost and margin on a document. */
  'invoices:read-cost',
  /** Raise supplier purchases and returns, not just sales. */
  'purchases:manage',
  /** Wholesale and account sales. */
  'sales:b2b:read',
  /** In-store and direct consumer sales. */
  'sales:b2c:read',
  /** Record a wholesale sale (same ledger as invoices, tagged B2B). */
  'sales:b2b:create',
  /** Record a retail sale (same ledger as invoices, tagged B2C). */
  'sales:b2c:create',
  /** Take money off a sale. */
  'sales:discount',
] as const

export type Action = (typeof ACTIONS)[number]

const PERMISSIONS: Record<Role, readonly Action[]> = {
  admin: ACTIONS,
  /* Business Managers run stock, catalog and transfers; only admins shape the
     network itself (users, branches, the warehouse) or void documents. */
  manager: [
    'branches:manage',
    'branches:read',
    'branches:edit',
    'products:read',
    'products:create',
    'products:edit',
    'products:archive',
    'products:read-cost',
    'stock:manage',
    'inventory:read',
    'transfers:read',
    'transfers:request',
    'transfers:approve',
    'transfers:dispatch',
    'transfers:receive',
    'stock:hold',
    'stock:count',
    'stock:report',
    'stock:dispose',
    'replenishment:read',
    'invoices:read',
    'invoices:create',
    'invoices:edit',
    'invoices:issue',
    'invoices:read-cost',
    'purchases:manage',
    'sales:b2b:read',
    'sales:b2c:read',
    'sales:b2b:create',
    'sales:b2c:create',
    'sales:discount',
  ],
  /*
   * A branch employee works the till and the stockroom: they sell, see their
   * own branch's balances, receive transfers and report count differences.
   * Corrections, holds and disposal stay with managers, and costs stay hidden.
   */
  employee: [
    'branches:read',
    'products:read',
    'inventory:read',
    'transfers:read',
    'transfers:receive',
    'stock:report',
    'invoices:read',
    'invoices:create',
    'invoices:issue',
    'sales:b2c:read',
    'sales:b2c:create',
  ],
}

export function can(role: Role, action: Action) {
  return PERMISSIONS[role].includes(action)
}

const COST_ACTIONS: readonly Action[] = ['products:read-cost', 'invoices:read-cost']

/** Backend permission key that guards every catalog write. */
export const CATALOG_WRITE = 'catalog.create'
const CATALOG_ACTIONS: readonly Action[] = ['products:create', 'products:edit', 'products:archive']

/**
 * Like `can`, but cost visibility follows the backend's `canViewCosts` flag
 * and catalog changes follow its `catalog.create` permission.
 */
export function canUser(user: User, action: Action) {
  if (COST_ACTIONS.includes(action)) return user.canViewCosts && can(user.role, action)
  if (CATALOG_ACTIONS.includes(action)) return user.permissions.includes(CATALOG_WRITE)
  return can(user.role, action)
}

/** True when the user may only ever see their own branch (managers and employees). */
export function isBranchScoped(user: User) {
  return !can(user.role, 'branches:view-all')
}

export function canAccessBranch(user: User, branchId: string) {
  if (can(user.role, 'branches:view-all')) return true
  return user.branchIds.includes(branchId)
}

/** The landing page a user is allowed to see: the overview, their own branch, or the catalog. */
export function homePathFor(user: User) {
  if (isBranchScoped(user)) return user.branchId ? `/branches/${user.branchId}` : '/products'
  return can(user.role, 'branches:view-all') ? '/dashboard' : '/products'
}

/** Path prefixes and the action each one needs. Longest prefix is checked first. */
const ROUTE_ACTIONS: [prefix: string, action: Action][] = [
  ['/products/new', 'products:create'],
  ['/sales/new', 'sales:b2c:create'],
  ['/sales/b2b', 'sales:b2b:read'],
  ['/sales/b2c', 'sales:b2c:read'],
  ['/transfers/new', 'transfers:request'],
  ['/transfers', 'transfers:read'],
  ['/inventory', 'inventory:read'],
  ['/stock-control', 'stock:report'],
  ['/replenishment', 'replenishment:read'],
  ['/users', 'users:manage'],
  // A document's own branch is only known once it loads, so /invoices/:id is
  // checked by the detail view rather than here.
  ['/invoices', 'invoices:read'],
]

/**
 * Where a user must be sent instead of `pathname`, or null when the path is allowed.
 * Scoped users never see the cross-branch overview or another branch's page.
 */
export function redirectPathFor(user: User, pathname: string): string | null {
  const home = homePathFor(user)
  if (pathname === home) return null

  if (pathname === '/dashboard' && !can(user.role, 'branches:view-all')) return home
  if (pathname === '/branches' && !can(user.role, 'branches:manage')) return home

  const rule = ROUTE_ACTIONS.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  if (rule && !canUser(user, rule[1])) return home

  const branchMatch = /^\/branches\/([^/]+)/.exec(pathname)
  if (branchMatch && !canAccessBranch(user, branchMatch[1])) return home

  return null
}

/**
 * Where to land after signing in: back to the page that was asked for when the
 * role may open it, otherwise that role's own home. Only in-app paths are
 * honoured, so a crafted `next` cannot bounce the user off-site.
 */
export function postLoginPathFor(user: User, next: string | null): string {
  const home = homePathFor(user)
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/login')) return home
  return redirectPathFor(user, next) ?? next
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  manager: 'Manager',
  employee: 'Employee',
}
