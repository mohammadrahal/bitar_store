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
  'products:read',
  'products:create',
  'products:edit',
  'products:delete',
  /** See cost price and margin. */
  'products:read-cost',
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
] as const

export type Action = (typeof ACTIONS)[number]

const PERMISSIONS: Record<Role, readonly Action[]> = {
  admin: ACTIONS,
  manager: [
    'branches:manage',
    'branches:read',
    'branches:edit',
    'products:read',
    'products:create',
    'products:edit',
    'products:delete',
    'products:read-cost',
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
  ],
  // An employee works the till: they raise and issue sales, and nothing else.
  employee: [
    'branches:read',
    'products:read',
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

/** True when the user may only ever see their own branch (managers and employees). */
export function isBranchScoped(user: User) {
  return !can(user.role, 'branches:view-all')
}

export function canAccessBranch(user: User, branchId: string) {
  if (can(user.role, 'branches:view-all')) return true
  if (!user.branchId) return false
  return user.branchId === branchId
}

/** The landing page a user is allowed to see: the overview, their own branch, or the catalog. */
export function homePathFor(user: User) {
  if (isBranchScoped(user)) return `/branches/${user.branchId}`
  return can(user.role, 'branches:view-all') ? '/dashboard' : '/products'
}

/**
 * Where a user must be sent instead of `pathname`, or null when the path is allowed.
 * Scoped users never see the cross-branch overview or another branch's page.
 */
export function redirectPathFor(user: User, pathname: string): string | null {
  const home = homePathFor(user)
  if (pathname === home) return null

  if (pathname === '/dashboard' && !can(user.role, 'branches:view-all')) return home
  if (pathname === '/branches' && !can(user.role, 'branches:manage')) return home
  if (pathname.startsWith('/users') && !can(user.role, 'users:manage')) return home
  // A document's own branch is only known once it loads, so /invoices/:id is
  // checked by the detail view rather than here.
  if (pathname.startsWith('/invoices') && !can(user.role, 'invoices:read')) return home
  if (pathname.startsWith('/sales/b2b') && !can(user.role, 'sales:b2b:read')) return home
  if (pathname.startsWith('/sales/b2c') && !can(user.role, 'sales:b2c:read')) return home

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
