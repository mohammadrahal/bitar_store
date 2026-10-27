export type Role = 'admin' | 'manager' | 'employee'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  /** null for admins, who are not scoped to a single branch. */
  branchId: string | null
  /** Every branch `GET /auth/me` says this user may see. */
  branchIds: string[]
  /** Permission keys from `GET /auth/me`, kept for backend-driven checks. */
  permissions: string[]
  canViewCosts: boolean
}

export interface Branch {
  id: string
  name: string
  /** Store code from the API, e.g. HAMRA. */
  code?: string
  location: string
  phone?: string
  isActive: boolean
  createdAt: string
}

export interface ProductDetails {
  season?: string
  brand?: string
  material?: string
  description?: string
}

export interface Product {
  id: string
  /** Style code, fixed once saved: MD000123. */
  code: string
  name: string
  category: string
  /** Kept on this device only: the API does not carry cost yet. */
  costPrice: number
  /** Lowest price among the active SKUs; each SKU carries its own. */
  sellPrice: number
  /** Archived models leave sale and transfer pickers but stay in history. */
  archived: boolean
  details?: ProductDetails
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

export interface StockLevel {
  variantId: string
  branchId: string
  /** Units physically at the location. */
  quantity: number
  /** Units promised to an approved transfer that has not left yet. */
  reserved: number
  /** Units kept out of sale: damaged, disputed or set aside. */
  onHold: number
  /** Quantity at or below which the variant counts as low stock. */
  lowStockAt: number
}

/** Header branch filter value meaning "do not scope to one branch". */
export const ALL_BRANCHES = 'all'
export type BranchScope = typeof ALL_BRANCHES | string

export type StockStatus = 'healthy' | 'low' | 'out'

/** Product as the table and form consume it: variants always loaded together. */
export interface ProductWithVariants extends Product {
  variants: Variant[]
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
  lowStockAt: number
  status: StockStatus
  /* Carried so a row can raise an adjustment priced at cost, the same way the
     document line picker already receives them. */
  costPrice: number
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
  lowStockCount: number
  outOfStockCount: number
}

export interface LowStockRow {
  variantId: string
  sku: string
  size: string
  color: string
  productId: string
  productName: string
  category: string
  branchId: string
  branchName: string
  quantity: number
  lowStockAt: number
  status: StockStatus
}

/** Sales and supplier purchases, plus the returns that reverse each of them. */
export type InvoiceKind =
  | 'sale'
  | 'purchase'
  | 'sale_return'
  | 'purchase_return'
  /** Stock correction in or out: a count, damage, theft or an opening balance. */
  | 'adjustment_in'
  | 'adjustment_out'

/** How a sale reached the customer: wholesale (B2B) or retail (B2C). */
export type SalesChannel = 'b2b' | 'b2c'

/** Drafts hold no stock. Issuing applies it; voiding gives it back. */
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'void'

export interface Invoice {
  id: string
  /** Human-facing, unique, assigned by the service: SAL-2026-0001. */
  number: string
  kind: InvoiceKind
  /** The branch whose books this document belongs to. */
  branchId: string
  /**
   * Customer on a sale, supplier on a purchase, the main branch on a transfer
   * leg. Empty on an adjustment, which has no counterparty and carries
   * `reason` instead.
   */
  partyName: string
  /** Why stock was corrected. Set on adjustments only. */
  reason?: string
  status: InvoiceStatus
  issuedAt: string
  /** Invoice-level discount in currency units, taken off the line subtotal. */
  discount: number
  notes?: string
  /** True for the legs of a branch-to-branch transfer, which earn no revenue. */
  isInternal: boolean
  /** The branch on the other side of an internal leg. */
  counterpartyBranchId?: string
  /** Links the two legs of one transfer. */
  transferId?: string
  /** Set on customer-facing sales and their returns; purchases leave this unset. */
  salesChannel?: SalesChannel
  createdAt: string
}

export interface InvoiceLine {
  id: string
  invoiceId: string
  variantId: string
  /** Snapshots from here down: history must survive renames, repricing and deletion. */
  sku: string
  productName: string
  size: string
  color: string
  quantity: number
  unitPrice: number
  unitCost: number
}

/** Invoice as the detail page and form consume it: lines always loaded together. */
export interface InvoiceWithLines extends Invoice {
  lines: InvoiceLine[]
}

export interface InvoiceTotals {
  subtotal: number
  discount: number
  total: number
  /** What the units on this document cost, for margin on sales. */
  cost: number
  margin: number
  units: number
}

/** Row shape for the invoice list: branch resolved, totals already summed. */
export interface InvoiceRow extends Invoice {
  branchName: string
  lineCount: number
  units: number
  total: number
}

/** A catalog variant offered to the invoice line picker. */
export interface VariantOption {
  variantId: string
  sku: string
  barcode: string
  productId: string
  productName: string
  size: string
  color: string
  costPrice: number
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
  /** Series in fixed order; colours are assigned from this, never from rank. */
  series: SalesSeries[]
  topProducts: TopSellerRow[]
  byBranch: BranchSalesRow[]
  documentCount: number
  totalUnits: number
  totalRevenue: number
}

export * from './operations'
