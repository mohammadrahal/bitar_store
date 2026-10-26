import type { BranchScope, InvoiceKind, InvoiceStatus, SalesChannel } from '@/types'

export interface ProductFilters {
  search: string
  category: string
}

export interface InvoiceFilters {
  scope: BranchScope
  kind: InvoiceKind | 'all'
  status: InvoiceStatus | 'all'
  search: string
  /** When set, only customer sales and returns for this channel are returned. */
  salesChannel?: SalesChannel
}

/** Every query key in the app, so invalidation never guesses at a shape. */
export const queryKeys = {
  users: {
    all: ['users'] as const,
    list: () => ['users', 'list'] as const,
  },
  branches: {
    all: ['branches'] as const,
    list: (scope: BranchScope) => ['branches', 'list', scope] as const,
    detail: (branchId: string) => ['branches', 'detail', branchId] as const,
  },
  products: {
    all: ['products'] as const,
    list: (filters: ProductFilters) => ['products', 'list', filters] as const,
    detail: (productId: string) => ['products', 'detail', productId] as const,
    categories: () => ['products', 'categories'] as const,
    variants: (search: string) => ['products', 'variants', search] as const,
  },
  analytics: {
    all: ['analytics'] as const,
    sales: (scope: BranchScope) => ['analytics', 'sales', scope] as const,
  },
  invoices: {
    all: ['invoices'] as const,
    list: (filters: InvoiceFilters) => ['invoices', 'list', filters] as const,
    detail: (invoiceId: string) => ['invoices', 'detail', invoiceId] as const,
    byProduct: (productId: string) => ['invoices', 'by-product', productId] as const,
  },
  stock: {
    all: ['stock'] as const,
    /* `branches` is the mirrored branch set these figures were computed from,
       so adding or renaming a branch re-reads them instead of serving a
       figure that predates it. */
    stats: (scope: BranchScope, branches: string) => ['stock', 'stats', scope, branches] as const,
    lowStock: (scope: BranchScope, branches: string) =>
      ['stock', 'low-stock', scope, branches] as const,
    byBranch: (branchId: string) => ['stock', 'by-branch', branchId] as const,
    /* On-hand per variant at one branch. Its own key, not `byBranch`: that one
       answers with a single total, and two queries of different shapes under
       one key serve each other's data to whichever mounted second. */
    onHand: (branchId: string) => ['stock', 'on-hand', branchId] as const,
    branchList: (branchId: string) => ['stock', 'branch-list', branchId] as const,
  },
} as const
