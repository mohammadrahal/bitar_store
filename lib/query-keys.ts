import type { BranchScope, InventoryFilter } from '@/types'

export interface ProductFilters {
  search: string
  category: string
  /** Active models by default; archived ones stay findable for history. */
  show?: 'active' | 'archived' | 'all'
}

/** Completed POS sales from `GET/POST /sales`. */
export const salesQueryKeys = {
  all: ['sales'] as const,
  list: (branchId: string, date: string) => ['sales', 'list', branchId, date] as const,
  history: (branchId: string, from: string, to: string, offset: number, search: string) =>
    ['sales', 'history', branchId, from, to, offset, search] as const,
  detail: (saleId: string) => ['sales', 'detail', saleId] as const,
  pendingSales: (branchId: string) => ['sales', 'pending-sales', branchId] as const,
} as const

/** Every query key in the app, so invalidation never guesses at a shape. */
export const queryKeys = {
  users: {
    all: ['users'] as const,
    list: () => ['users', 'list'] as const,
    /** Locations and permission keys for one account. */
    access: (userId: string) => ['users', 'access', userId] as const,
    permissionCatalog: () => ['users', 'permission-catalog'] as const,
    permissions: (userId: string) => ['users', 'permissions', userId] as const,
    branchAccess: (userId: string) => ['users', 'branch-access', userId] as const,
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
    categoryRecords: (activeOnly: boolean) => ['products', 'category-records', activeOnly] as const,
    /** The whole API catalog, mirrored so stock can point at real SKUs. */
    catalog: () => ['products', 'catalog'] as const,
    priceHistory: (variantId: string) => ['products', 'price-history', variantId] as const,
    variants: (search: string) => ['products', 'variants', search] as const,
    /** One SKU code or barcode resolved to its id, for screens that filter by variant. */
    skuId: (reference: string) => ['products', 'sku-id', reference] as const,
  },
  analytics: {
    all: ['analytics'] as const,
    /* `days` is part of the key: the same scope over 7 and over 90 days are two
       different answers from the same endpoint. */
    sales: (scope: BranchScope, source: 'reports' | 'sales' = 'sales', days?: number) =>
      ['analytics', 'sales', scope, source, days ?? 'today'] as const,
  },
  sales: salesQueryKeys,
  stock: {
    all: ['stock'] as const,
    /* `branches` is the mirrored branch set these figures were computed from,
       so adding or renaming a branch re-reads them instead of serving a
       figure that predates it. */
    /* The cards and the attention list are two views of the same `GET /stock`
       pages, so they share one query rather than fetching every branch twice. */
    overview: (scope: BranchScope, branches: string) => ['stock', 'overview', scope, branches] as const,
    byBranch: (branchId: string) => ['stock', 'by-branch', branchId] as const,
    /* Units behind the catalog screens, one key per scope so the header filter
       narrows them like every other stock read. */
    byProduct: (scope: BranchScope) => ['stock', 'by-product', scope] as const,
    styleUnits: (productId: string, scope: BranchScope) => ['stock', 'style-units', productId, scope] as const,
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
    /* What is empty or under its minimum, counted in variants rather than in
       variant-and-location pairs. Keyed by the mirrored branch set, like the
       other balance reads. */
    health: (scope: BranchScope, branches: string) => ['stock', 'health', scope, branches] as const,
    picker: (branchId: string, search: string) => ['stock', 'picker', branchId, search] as const,
    /** Corrections and receipts from `GET /stock/adjustments`. */
    adjustments: (scope: BranchScope) => ['stock', 'adjustments', scope] as const,
    /** Legacy receipt documents, still read from this device. */
    receipts: (scope: BranchScope) => ['stock', 'receipts', scope] as const,
    receipt: (id: string) => ['stock', 'receipt', id] as const,
    /** Supplier deliveries from `GET /goods-receipts`. The shared record. */
    goodsReceipts: (search: string, offset: number) => ['stock', 'goods-receipts', search, offset] as const,
    goodsReceipt: (id: string) => ['stock', 'goods-receipt', id] as const,
    saleModels: (search: string) => ['stock', 'sale-models', search] as const,
    saleModelsAtBranch: (branchId: string, search: string) =>
      ['stock', 'sale-models-at-branch', branchId, search] as const,
    saleVariants: (branchId: string, productId: string) => ['stock', 'sale-variants', branchId, productId] as const,
    saleVariantsAtBranch: (branchId: string, productId: string) =>
      ['stock', 'sale-variants-at-branch', branchId, productId] as const,
  },
  locations: {
    warehouse: () => ['locations', 'warehouse'] as const,
  },
  openingStock: {
    all: ['opening-stock'] as const,
    post: (branchId: string) => ['opening-stock', 'post', branchId] as const,
  },
  transfers: {
    all: ['transfers'] as const,
    supplyInvoice: (transferId: string) => ['transfers', 'supply-invoice', transferId] as const,
    list: (branchId: string, status: string, offset: number) =>
      ['transfers', 'list', branchId, status, offset] as const,
    detail: (id: string) => ['transfers', 'detail', id] as const,
  },
  warehouse: {
    all: ['warehouse'] as const,
    stockNetwork: (search: string, offset: number) => ['warehouse', 'overview', search, offset] as const,
    reorderLevels: (branchId: string, search: string) => ['warehouse', 'reorder-levels', branchId, search] as const,
    replenishment: (branchId: string) => ['warehouse', 'replenishment', branchId] as const,
  },
  /** Server invoices from `GET /invoices`. */
  apiInvoices: {
    all: ['api-invoices'] as const,
    list: (scope: string) => ['api-invoices', 'list', scope] as const,
    detail: (id: string) => ['api-invoices', 'detail', id] as const,
  },
  reports: {
    all: ['reports'] as const,
    summary: (branchId: string, from: string, to: string) => ['reports', 'summary', branchId, from, to] as const,
    topSkus: (branchId: string, from: string, to: string) => ['reports', 'top-skus', branchId, from, to] as const,
    audit: (offset: number) => ['reports', 'audit', offset] as const,
  },
  /** `GET /settings`: the business-wide rules, exchange rate included. */
  settings: {
    all: ['settings'] as const,
    store: () => ['settings', 'store'] as const,
    /** Kept apart so the till can read the rate without the rest of the row. */
    exchangeRate: () => ['settings', 'exchange-rate'] as const,
  },
  /** `GET /suppliers`: who the warehouse buys from. */
  suppliers: {
    all: ['suppliers'] as const,
    list: (search: string, active: string, offset: number) =>
      ['suppliers', 'list', search, active, offset] as const,
    detail: (id: string) => ['suppliers', 'detail', id] as const,
  },
  /** `GET /cash-sessions`: the drawer. */
  cashSessions: {
    all: ['cash-sessions'] as const,
    /* The open session at one branch. Its own key, not `detail`: the till asks
       "is a drawer open here" and gets `null` for an answer, which `detail`
       never returns. */
    current: (branchId: string) => ['cash-sessions', 'current', branchId] as const,
    detail: (id: string) => ['cash-sessions', 'detail', id] as const,
    list: (branchId: string, status: string, review: string, offset: number) =>
      ['cash-sessions', 'list', branchId, status, review, offset] as const,
  },
  /** `GET /returns`: customer returns. */
  returns: {
    all: ['returns'] as const,
    list: (branchId: string, saleId: string, status: string, offset: number) =>
      ['returns', 'list', branchId, saleId, status, offset] as const,
    detail: (id: string) => ['returns', 'detail', id] as const,
    /* `GET /returns/eligible?sale=`. Keyed by what was typed, because the
       lookup accepts the sale id *or* its printed number and the counter may
       try both. It is a lookup, not a cache of the sale. */
    eligible: (sale: string) => ['returns', 'eligible', sale] as const,
  },
  /** `GET /costs`: cost and profit. Admin or manager only. */
  costs: {
    all: ['costs'] as const,
    sku: (skuId: string) => ['costs', 'sku', skuId] as const,
    profit: (branchId: string, from: string, to: string) =>
      ['costs', 'profit', branchId, from, to] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    overview: (scope: BranchScope) => ['dashboard', 'overview', scope] as const,
    trend: (scope: BranchScope, days: number) => ['dashboard', 'trend', scope, days] as const,
    trendComparison: (scope: BranchScope, days: number) => ['dashboard', 'trend-previous', scope, days] as const,
  },
} as const
