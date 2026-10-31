export type Role = 'super_admin' | 'manager' | 'employee'

/** What an employee may do at one of their locations. */
export type LocationAccess = 'full' | 'view_only'

export interface LocationAssignment {
  locationId: string
  access: LocationAccess
}

export interface User {
  id: string
  name: string
  email: string
  role: Role
  /** The location an employee works in by default; null for the owner roles. */
  branchId: string | null
  /** Every branch `GET /auth/me` says this user may see. */
  branchIds: string[]
  /** Assignments with their access level. The API only returns ids, so
      view-only comes from the local store until it can store the grant. */
  locations: LocationAssignment[]
  /** Permission keys from `GET /auth/me`, platform-wide as far as the API knows. */
  permissions: string[]
  /** Per-location keys kept locally, plus platform-wide ones under `*`. */
  grants: Record<string, string[]>
  canViewCosts: boolean
}

/** A selling location, or the warehouse the branches are replenished from. */
export type BranchKind = 'branch' | 'warehouse'

export interface Branch {
  id: string
  name: string
  /** From `GET /branches`. A server without the field reads as `branch`. */
  kind: BranchKind
  /** Store code from the API, e.g. HAMRA. */
  code?: string
  location: string
  phone?: string
  isActive: boolean
  createdAt: string
}

export interface Product {
  id: string
  /** Style code, fixed once saved: MD000123. */
  code: string
  name: string
  category: string
  /** Lowest price among the active SKUs; each SKU carries its own. */
  sellPrice: number
  /** Archived models leave sale and transfer pickers but stay in history. */
  archived: boolean
  createdAt: string
}

export interface Variant {
  id: string
  productId: string
  /** Model code plus the variant code: MD000123-BLK-S. */
  sku: string
  /** Color and size part of the SKU: BLK-S. */
  code: string
  /** First barcode registered for the SKU, or empty until one is known. */
  barcode: string
  size: string
  color: string
  /** Standard price of this SKU. */
  sellPrice: number
  currency: string
  /** Inactive SKUs leave sale and transfer pickers but stay in history. */
  archived: boolean
}

export interface Barcode {
  id: string
  code: string
  createdAt: string
}

export interface PriceChange {
  id: string
  oldPrice: number | null
  newPrice: number
  effectiveAt: string
  changedBy: string | null
}

/** A model with every SKU's barcodes, for the product page. */
export interface ProductDetail extends ProductWithVariants {
  barcodes: Record<string, Barcode[]>
}

/** Header branch filter value meaning "do not scope to one branch". */
export const ALL_BRANCHES = 'all'
export type BranchScope = typeof ALL_BRANCHES | string

export type StockStatus = 'healthy' | 'out'

/** Product as the table and form consume it: variants always loaded together. */
export interface ProductWithVariants extends Product {
  variants: Variant[]
}

/** On hand and sellable, summed over whatever locations were asked for. */
export interface Units {
  onHand: number
  available: number
}

/** One variant's position at one branch, for the branch stock list. */
export interface BranchStockRow {
  variantId: string
  sku: string
  barcode: string
  size: string
  color: string
  productId: string
  productName: string
  category: string
  /** On hand. */
  quantity: number
  /** On hand less reserved and on hold. */
  available: number
  status: StockStatus
  sellPrice: number
}

export interface InventoryStats {
  /** Locations inside the current scope, warehouse included. */
  branchCount: number
  warehouseCount: number
  /** Catalog size, which is the same whatever branch is in scope. */
  productCount: number
  variantCount: number
  /** Variants holding at least one unit inside the scope. */
  inStockVariantCount: number
  stockUnits: number
}

/** A style row on the new-sale model picker. */
export interface SaleModelOption {
  productId: string
  productCode: string
  productName: string
}

/** A catalog variant offered to the invoice line picker. */
export interface VariantOption {
  variantId: string
  sku: string
  barcode: string
  productId: string
  productName: string
  /** Style code, set on till variants for labels. */
  productCode?: string
  size: string
  color: string
  sellPrice: number
  /** Available at the branch the picker was opened for, when it was given one. */
  available?: number
}

/** One coloured series in a sales chart: a branch, or the folded "Other". */
export interface SalesSeries {
  id: string
  name: string
}

export interface TopSellerRow {
  productName: string
  /** Net units: sales less returns, so this can fall. */
  units: number
  revenue: number
  /** Units per series id, for the stacked bars. */
  byBranch: Record<string, number>
}

export interface BranchSalesRow {
  branchId: string
  branchName: string
  units: number
  revenue: number
}

export interface SalesAnalytics {
  /** The business date `GET /sales` answered for, which is what these cover. */
  businessDate: string
  /** Series in fixed order; colours are assigned from this, never from rank. */
  series: SalesSeries[]
  topProducts: TopSellerRow[]
  byBranch: BranchSalesRow[]
  documentCount: number
  totalUnits: number
  totalRevenue: number
}

export * from './operations'
