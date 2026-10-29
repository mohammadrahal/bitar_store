import type { BranchScope, InventoryFilter, InvoiceKind, InvoiceStatus, SalesChannel, TransferStatus } from '@/types'

export interface ProductFilters {
  search: string
  category: string
  /** Active models by default; archived ones stay findable for history. */
  show?: 'active' | 'archived' | 'all'
}

export interface InvoiceFilters {
  scope: BranchScope
  kind: InvoiceKind | 'all'
  status: InvoiceStatus | 'all'
  search: string
  /** When set, only customer sales and returns for this channel are returned. */
  salesChannel?: SalesChannel
}

/** Completed POS sales from `GET/POST /sales`. */
export const salesQueryKeys = {
  all: ['sales'] as const,
  list: (branchId: string, date: string) => ['sales', 'list', branchId, date] as const,
  detail: (saleId: string) => ['sales', 'detail', saleId] as const,
} as const

/** Every query key in the app, so invalidation never guesses at a shape. */
export const queryKeys = {
  users: {
    all: ['users'] as const,
    list: () => ['users', 'list'] as const,
    /** Locations and permission keys for one account. */
    access: (userId: string) => ['users', 'access', userId] as const,
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
    /** The whole API catalog, mirrored so stock can point at real SKUs. */
    catalog: () => ['products', 'catalog'] as const,
    priceHistory: (variantId: string) => ['products', 'price-history', variantId] as const,
    variants: (search: string) => ['products', 'variants', search] as const,
  },
  analytics: {
    all: ['analytics'] as const,
    sales: (scope: BranchScope) => ['analytics', 'sales', scope] as const,
  },
  sales: salesQueryKeys,
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
    /* The cards and the attention list are two views of the same `GET /stock`
       pages, so they share one query rather than fetching every branch twice. */
    overview: (scope: BranchScope, branches: string) => ['stock', 'overview', scope, branches] as const,
    byBranch: (branchId: string) => ['stock', 'by-branch', branchId] as const,
    /* On-hand per variant at one branch. Its own key, not `byBranch`: that one
       answers with a single total, and two queries of different shapes under
       one key serve each other's data to whichever mounted second. */
    onHand: (branchId: string) => ['stock', 'on-hand', branchId] as const,
    branchList: (branchId: string) => ['stock', 'branch-list', branchId] as const,
    /* Everything below reads the same balances, so it lives under `stock` and
       one invalidation after any movement refreshes all of it. */
    inventory: (scope: BranchScope, filter: InventoryFilter, search: string) =>
      ['stock', 'inventory', scope, filter, search] as const,
    variant: (variantId: string) => ['stock', 'variant', variantId] as const,
    holds: (scope: BranchScope) => ['stock', 'holds', scope] as const,
    countSheet: (branchId: string) => ['stock', 'count-sheet', branchId] as const,
    countReports: (scope: BranchScope) => ['stock', 'count-reports', scope] as const,
    replenishment: (scope: BranchScope) => ['stock', 'replenishment', scope] as const,
    operations: (scope: BranchScope) => ['stock', 'operations', scope] as const,
    picker: (branchId: string, search: string) => ['stock', 'picker', branchId, search] as const,
    saleModels: (search: string) => ['stock', 'sale-models', search] as const,
    saleVariants: (branchId: string, productId: string) => ['stock', 'sale-variants', branchId, productId] as const,
  },
  transfers: {
    all: ['transfers'] as const,
    list: (scope: BranchScope, status: TransferStatus | 'open' | 'all') => ['transfers', 'list', scope, status] as const,
    detail: (transferId: string) => ['transfers', 'detail', transferId] as const,
  },
  attributes: {
    all: ['attributes'] as const,
    colors: () => ['attributes', 'colors'] as const,
  },
  locations: {
    warehouse: () => ['locations', 'warehouse'] as const,
  },
  replenishmentRequests: {
    all: ['replenishment-requests'] as const,
    list: (scope: BranchScope, status: string) => ['replenishment-requests', 'list', scope, status] as const,
  },
  openingStock: {
    all: ['opening-stock'] as const,
    post: (branchId: string) => ['opening-stock', 'post', branchId] as const,
  },
} as const
