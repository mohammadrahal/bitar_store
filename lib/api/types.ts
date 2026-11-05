export type UserRole = 'admin' | 'manager' | 'employee'

export interface ApiUser {
  id: string
  email: string
  fullName: string
  role: UserRole
  isActive: boolean
  hasPassword: boolean
  deactivatedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface LoginResponse {
  token: string
  user: ApiUser
}

/** `GET /auth/me`: who the token belongs to and what they may reach. */
export interface MeResponse {
  user: ApiUser
  permissions: string[]
  branchIds: string[]
  canViewCosts: boolean
}

/** A selling location or the warehouse stock is replenished from. */
export type ApiBranchKind = 'branch' | 'warehouse'

export interface ApiBranch {
  id: string
  code: string
  name: string
  kind: ApiBranchKind
  isActive: boolean
  createdAt: string
}

/** Passwords never travel here; they are set with `PUT /users/:id/password`. */
export interface CreateUserInput {
  email: string
  fullName: string
  role: UserRole
}

export interface UpdateUserInput {
  email?: string
  fullName?: string
  role?: UserRole
  isActive?: boolean
}

export interface CreateBranchInput {
  code: string
  name: string
  /** Defaults to `branch` on the server. */
  kind?: ApiBranchKind
}

/** PATCH /branches/:id */
export interface UpdateBranchInput {
  name?: string
  isActive?: boolean
  kind?: ApiBranchKind
}

/** A model in the catalog. The code is fixed once created. */
export interface ApiStyle {
  id: string
  code: string
  name: string
  category: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** Money travels as text with two decimals: "25.00". */
export interface ApiSku {
  id: string
  styleId: string
  skuCode: string
  size: string
  color: string
  standardPrice: string
  currency: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ApiStyleDetail extends ApiStyle {
  skus: ApiSku[]
}

export interface ApiSkuWithStyle extends ApiSku {
  style: { id: string; code: string; name: string }
}

export interface ApiBarcode {
  id: string
  skuId: string
  code: string
  createdAt: string
}

export interface ApiSkuDetail extends ApiSkuWithStyle {
  barcodes: ApiBarcode[]
}

export interface ApiPriceChange {
  id: string
  skuId: string
  oldPrice: string | null
  newPrice: string
  effectiveAt: string
  changedBy: string | null
}

export interface CatalogListParams {
  search?: string
  activeOnly?: boolean
  /** 1 to 200, 50 when left out. */
  limit?: number
  offset?: number
}

export interface SkuListParams extends CatalogListParams {
  styleId?: string
}

export interface CreateStyleInput {
  code: string
  name: string
  category?: string | null
}

export interface UpdateStyleInput {
  name?: string
  category?: string | null
  isActive?: boolean
}

export interface CreateSkuInput {
  styleId: string
  skuCode: string
  size: string
  color: string
  standardPrice: string | number
  currency?: string
}

/** The price is not here: it changes through `PUT /skus/:id/price` so it is recorded. */
export interface UpdateSkuInput {
  size?: string
  color?: string
  isActive?: boolean
}

export interface StockListParams {
  branchId: string
  search?: string
  styleId?: string
  activeOnly?: boolean
  limit?: number
  offset?: number
}

export interface ApiStockItem {
  sku: ApiSkuWithStyle
  sellable: number
  nonSellable: number
  inTransit: number
}

export interface OpeningStockInput {
  branchId: string
  lines: { skuId: string; quantity: number }[]
}

export interface OpeningStockResult {
  batchId: string
  lines: number
}

/**
 * `POST /stock/adjustments` — the one way to change a balance after a SKU has
 * been opened at a location. One SKU per call, so a document with several lines
 * is several calls.
 *
 * The server's own wording for `quantityDelta`: "a whole number other than 0
 * (up to 100000, negative to take pieces out)".
 */
export interface StockAdjustmentInput {
  branchId: string
  skuId: string
  bucket?: 'sellable' | 'non_sellable'
  quantityDelta: number
  reason: ApiAdjustmentReason
  /** Required, 5 to 200 characters, and kept in the audit log. */
  note: string
}

/**
 * Every reason the server accepts. They are all corrections — there is no
 * `purchase` or `receipt` among them, which is why a goods receipt is posted as
 * `other` with the document's reference in the note. See `ARCHITECTURE.md`
 * section 9.
 */
export const ADJUSTMENT_REASONS = [
  'count_correction',
  'damage',
  'loss',
  'found',
  'data_entry_error',
  'other',
] as const

export type ApiAdjustmentReason = (typeof ADJUSTMENT_REASONS)[number]

export interface ApiStockAdjustment {
  id: string
  reference: string
  branch: { id: string; code: string; name: string }
  sku: { id: string; code: string; styleName: string; size: string; color: string }
  bucket: string
  quantityDelta: number
  reason: ApiAdjustmentReason
  note: string
  by: { id: string; name: string | null }
  createdAt: string
  balanceAfter: number | null
}

export interface StockAdjustmentParams {
  branchId?: string
  skuId?: string
  reason?: ApiAdjustmentReason
  from?: string
  to?: string
  limit?: number
  offset?: number
}

/** `GET /stock/overview` (admin): the same filters as the stock list, less the branch. */
export interface StockOverviewParams {
  search?: string
  styleId?: string
  activeOnly?: boolean
  limit?: number
  offset?: number
}

export interface StockMovementParams {
  branchId: string
  skuId?: string
  type?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export interface ApiLocation {
  id: string
  code: string
  name: string
  kind: ApiBranchKind
}

export interface ApiQuantities {
  sellable: number
  nonSellable: number
  inTransit: number
}

/** `GET /stock/overview` (admin only). */
export interface ApiStockOverview {
  locations: ApiLocation[]
  items: {
    sku: ApiSkuWithStyle
    totals: ApiQuantities
    locations: (ApiQuantities & {
      branchId: string
      minQuantity: number | null
      targetQuantity: number | null
      belowMinimum: boolean
    })[]
  }[]
}

export interface ApiStockMovement {
  id: string
  occurredAt: string
  type: string
  bucket: string
  quantityDelta: number
  balanceAfter: number
  sku: { id: string; code: string }
  by: { id: string; name: string | null }
  saleId: string | null
  reason: string | null
}

/** The minimum and target a branch keeps per SKU (`GET /reorder-levels`). */
export interface ApiReorderLevel {
  id: string
  branchId: string
  sku: { id: string; code: string; styleName: string; size: string; color: string }
  minQuantity: number
  targetQuantity: number | null
  updatedAt: string
}

export interface ReorderLevelListParams {
  branchId: string
  search?: string
  limit?: number
  offset?: number
}

export interface ReorderLevelInput {
  branchId: string
  skuId: string
  minQuantity: number
  targetQuantity?: number
}

export interface ReorderLevelByStyleInput {
  branchId: string
  styleId: string
  minQuantity: number
  targetQuantity?: number
}

export interface ApiReplenishmentSuggestion {
  branch: ApiLocation
  sku: { id: string; code: string; styleName: string; size: string; color: string }
  sellable: number
  inTransit: number
  minQuantity: number
  targetQuantity: number | null
  suggested: number
  warehouseSellable: number
  fillable: number
}

export interface ApiReplenishmentSuggestions {
  warehouse: ApiLocation | null
  suggestions: ApiReplenishmentSuggestion[]
}

export interface ApiSalesSummaryRow {
  salesCount: number
  items: number
  revenue: string
  discounts: string
  cash: string
  whish: string
  inStore: string
  socialMedia: string
}

export interface ApiSalesSummary {
  from: string
  to: string
  totals: ApiSalesSummaryRow
  rows: (ApiSalesSummaryRow & { day: string; branch: ApiLocation | { id: string } })[]
}

/** `GET /dashboard/overview` — needs `reports.financial`. Omit `branchId` to aggregate accessible branches. */
export interface ApiDashboardOverview {
  stock: {
    products: number
    variantsInStock: number
    totalUnits: number
    lowStock: number
    outOfStock: number
  }
  locations: {
    warehouses: number
    branches: number
  }
  today: {
    docs: number
    /** Two-decimal money string from the server. */
    revenue: string
  }
}

export interface DashboardOverviewParams {
  branchId?: string
}

export interface ApiTopSkusResult {
  from: string
  to: string
  rows: {
    sku: { id: string; code: string; styleName: string; size: string; color: string }
    quantity: number
    revenue: string
    salesCount: number
  }[]
}

export interface ApiAuditEvent {
  id: string
  occurredAt: string
  action: string
  entityType: string
  entityId: string | null
  branchId: string | null
  by: { id: string; name: string | null }
  details: Record<string, unknown>
}

/** `GET /reports/*`: a closed date range at one branch. */
export interface ReportRangeParams {
  branchId?: string
  from?: string
  to?: string
}

export interface AuditEventParams {
  entityType?: string
  entityId?: string
  actorId?: string
  branchId?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export type ApiSaleChannel = 'in_store' | 'social_media'
export type ApiSocialPlatform = 'facebook' | 'instagram' | 'whatsapp' | 'other'
export type ApiPaymentMethod = 'cash' | 'whish'

export interface ApiSaleLineDiscountPercent {
  type: 'percent'
  percent: string
  reason: string
  approvedBy: string
}

export interface ApiSaleLineDiscountOverride {
  type: 'override'
  unitPrice: string
  reason: string
  approvedBy: string
}

export interface ApiSaleLine {
  lineNo: number
  skuId: string
  skuCode: string
  styleName: string
  size: string
  color: string
  quantity: number
  unitPrice: string
  discount: ApiSaleLineDiscountPercent | ApiSaleLineDiscountOverride | null
  lineTotal: string
}

export interface ApiSalePayment {
  method: ApiPaymentMethod
  amount: string
  tendered: string | null
  change: string | null
  reference: string | null
}

/** `409` when stock is short on `POST /sales` or transfer dispatch. */
export interface StockShortage {
  skuId: string
  skuCode: string
  requested: number
  available: number
}

export type TransferStatus = 'draft' | 'dispatched' | 'partially_received' | 'received' | 'closed' | 'cancelled'

export interface ApiTransferLine {
  sku: { id: string; code: string; styleName: string; size: string; color: string }
  requested: number
  dispatched: number
  received: number
  damaged: number
  releasedToSellable: number
  onHold: number
  lost: number
  onTheRoad: number
}

export interface ApiTransfer {
  id: string
  reference: string
  status: TransferStatus
  from: ApiLocation
  to: ApiLocation
  note: string | null
  requestedBy: { id: string; name: string | null }
  requestedAt: string
  dispatchedBy: { id: string; name: string | null } | null
  dispatchedAt: string | null
  lines: ApiTransferLine[]
  totals: {
    requested: number
    dispatched: number
    received: number
    damaged: number
    releasedToSellable: number
    onHold: number
    lost: number
    onTheRoad: number
  }
}

export interface CreateTransferInput {
  sourceBranchId: string
  destinationBranchId: string
  note?: string
  lines: { skuId: string; quantity: number }[]
}

export interface ListTransfersParams {
  branchId?: string
  status?: TransferStatus
  limit?: number
  offset?: number
}

export interface ApiSale {
  id: string
  reference: string
  branchId: string
  soldBy: { id: string; name: string | null }
  status: string
  channel: ApiSaleChannel
  socialPlatform: ApiSocialPlatform | null
  currency: string
  subtotal: string
  totalDiscount: string
  total: string
  totalPaid: string
  soldAt: string
  businessDate: string
  note: string | null
  lines: ApiSaleLine[]
  payments: ApiSalePayment[]
}

export interface CreateSaleLineInput {
  skuId: string
  quantity: number
  discount?:
    | { type: 'percent'; percent: string; reason: string }
    | { type: 'override'; unitPrice: string; reason: string }
}

export interface CreateSalePaymentInput {
  method: ApiPaymentMethod
  amount: string | number
  tendered?: string | number
  reference?: string
}

export interface CreateSaleInput {
  branchId: string
  channel?: ApiSaleChannel
  socialPlatform?: ApiSocialPlatform
  note?: string | null
  lines: CreateSaleLineInput[]
  payments: CreateSalePaymentInput[]
}

export interface SalesListParams {
  branchId: string
  date?: string
  limit?: number
  offset?: number
}

export interface SalesListResult {
  businessDate: string
  sales: ApiSale[]
}

export interface HealthResponse {
  status: string
}

/** `GET /categories`: a name a product may use. */
export interface ApiCategory {
  id: string
  name: string
  isActive: boolean
  productCount: number
  createdAt: string
}

export interface UpdateCategoryInput {
  name?: string
  isActive?: boolean
}

/** `GET /warehouse`: the main inventory. A branch user does not see it on `GET /branches`. */
export interface ApiWarehouse {
  id: string
  code: string
  name: string
}

/** One row from `GET /sales/history`. */
export interface ApiSaleHistoryRow {
  id: string
  reference: string
  branch: { id: string; code: string; name: string }
  soldAt: string
  businessDate: string
  soldBy: { id: string; name: string | null }
  status: string
  channel: string
  items: number
  total: string
  discounts: string
  cash: string
  whish: string
}

export interface SalesHistoryParams {
  branchId?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export interface SalesHistoryResult {
  from: string
  to: string
  sales: ApiSaleHistoryRow[]
  total: number
}

/** How a permission applies to one user. */
export type PermissionSource = 'role' | 'granted' | 'denied' | 'none'

export interface ApiPermissionLine {
  key: string
  label: string
  description: string
  allowed: boolean
  source: PermissionSource
}

export interface ApiPermissionCatalog {
  permissions: { key: string; label: string; description: string; grantable: boolean }[]
  roles: Record<string, string[]>
}

export interface ApiUserPermissions {
  user: { id: string; fullName: string; role: string; isActive: boolean }
  permissions: ApiPermissionLine[]
  overrides: { permission: string; effect: 'allow' | 'deny' }[]
}

/** `GET /users/:id/branch-access`. `all` covers every shop, including ones opened later, and never the warehouse. */
export interface ApiBranchAccess {
  userId: string
  mode: 'all' | 'selected'
  branchIds: string[]
}

/** `GET /places`: active locations for transfer forms (warehouse first). */
export type ApiPlace = ApiLocation

export interface GoodsReceiptLineInput {
  skuId: string
  quantity: number
  unitCost: string | number
}

export interface CreateGoodsReceiptInput {
  supplierName: string
  supplierInvoiceNumber: string
  invoiceDate?: string
  currency?: string
  note?: string
  lines: GoodsReceiptLineInput[]
}

export interface ApiGoodsReceiptSummary {
  id: string
  reference: string
  warehouse: { id: string; code: string; name: string }
  supplierName: string
  supplierInvoiceNumber: string
  invoiceDate: string
  currency: string
  note: string | null
  totalCost: string
  receivedBy: { id: string; name: string | null }
  createdAt: string
  lineCount: number
  totalQuantity: number
}

export interface ApiGoodsReceipt extends ApiGoodsReceiptSummary {
  lines: {
    sku: { id: string; code: string; styleName: string; size: string; color: string }
    quantity: number
    unitCost: string
    lineTotal: string
  }[]
}

export interface ListGoodsReceiptsParams {
  supplier?: string
  invoiceNumber?: string
  skuId?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export type ApiInvoiceKind = 'b2b' | 'b2c'
export type ApiInvoiceStatus = 'draft' | 'final' | 'void'

export type CreateInvoiceInput =
  | { transferId: string; note?: string }
  | { saleId: string; customerName?: string; customerPhone?: string; note?: string }

export interface ApiInvoiceSummary {
  id: string
  kind: ApiInvoiceKind
  status: ApiInvoiceStatus
  reference: string | null
  issuer: { id: string; name: string }
  recipient: { branchId: string | null; name: string | null; phone: string | null }
  transfer: { id: string; reference: string } | null
  sale: { id: string; reference: string } | null
  currency: string
  subtotal: string
  discountTotal: string
  total: string
  note: string | null
  issuedBy: { id: string; name: string | null }
  createdAt: string
  finalizedAt: string | null
  voided: { at: string; by: { id: string; name: string | null }; reason: string } | null
  lineCount: number
}

export interface ApiInvoiceLine {
  lineNo: number
  sku: { id: string; code: string }
  description: string
  quantity: number
  unitPrice: string
  discount: string
  lineTotal: string
}

export interface ApiInvoice extends ApiInvoiceSummary {
  lines: ApiInvoiceLine[]
  payments: { method: string; amount: string; reference: string | null }[]
}

export interface ListInvoicesParams {
  kind?: ApiInvoiceKind
  status?: ApiInvoiceStatus
  branchId?: string
  search?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}
