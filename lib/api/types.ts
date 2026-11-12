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
 * `POST /stock/adjustments`. the one way to change a balance after a SKU has
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
 * Every reason the server accepts. They are all corrections. there is no
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
  /**
   * What the returns approved in this period give back, and `revenue` less that.
   *
   * These two arrived with the returns API; an older server omits them, so read
   * them through `refundsOf` / `netRevenueOf` rather than directly.
   *
   * `netRevenue` can be **negative** for a branch: a refund is counted at the
   * branch that handed the money back, which may not be the branch that sold
   * the goods. Do not clamp it to zero — a negative figure is the true picture
   * of a branch that only took returns that day.
   */
  refunds?: string
  netRevenue?: string
}

/**
 * `GET /reports/sales-summary`.
 *
 * Four views of **the same revenue**, never to be added together:
 *
 * - `totals`: every branch in scope, as one figure.
 * - `byBranch`: one entry per branch, including branches that sold nothing.
 * - `byDay`: every branch in scope, split by day.
 * - `rows`: the original day x branch grid.
 *
 * Within one row, `inStore + socialMedia` and `cash + whish` are two different
 * splits of `revenue`. Summing a channel with a payment method double-counts.
 */
export interface ApiSalesSummary {
  from: string
  to: string
  totals: ApiSalesSummaryRow
  /** One entry per branch in scope. Added 9 Nov; absent on older servers. */
  byBranch?: (ApiSalesSummaryRow & { branch: ApiLocation | { id: string } })[]
  /** One entry per day, all branches in scope together. Added 9 Nov. */
  byDay?: (ApiSalesSummaryRow & { day: string })[]
  rows: (ApiSalesSummaryRow & { day: string; branch: ApiLocation | { id: string } })[]
}

/** `GET /dashboard/overview`. needs `reports.financial`. Omit `branchId` to aggregate accessible branches. */
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
export type ApiSocialPlatform = 'facebook' | 'instagram' | 'whatsapp' | 'tiktok' | 'other'
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

/**
 * The live supply invoice of a transfer, on `GET /transfers` and
 * `GET /transfers/:id` (9 Nov). `null` when none exists or the only one was
 * voided; `reference` is `null` while it is still a draft.
 *
 * Dispatching raises this draft by itself, with the quantities really sent, so
 * **never gate receiving or "Confirm for sale" on it**: in BL-03 the invoice is
 * finalized after the movement is reconciled, and the receiving branch does not
 * wait for it.
 */
export interface ApiTransferSupplyInvoice {
  id: string
  reference: string | null
  status: ApiInvoiceStatus
  total: string
}

/** One receiving pass on a transfer, from `POST /transfers/:id/receive`. Oldest first. */
export interface ApiTransferReceipt {
  id: string
  at: string
  by: { id: string; name: string | null }
  note: string | null
  lines: { skuId: string; accepted: number; damaged: number }[]
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
  /** Added 9 Nov. `undefined` on an older server, `null` when there is none. */
  supplyInvoice?: ApiTransferSupplyInvoice | null
  /** Added 9 Nov: the receiving passes, with the inspector's note. */
  receipts?: ApiTransferReceipt[]
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
  /** Optional on the sale; also mirrored on the B2C fiscal invoice recipient when issued. */
  customerName?: string | null
  customerPhone?: string | null
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
  currency?: 'USD' | 'LBP'
  /** USD value of the change given back in pounds. */
  changeLbp?: string | number
}

export interface CreateSaleInput {
  branchId: string
  channel?: ApiSaleChannel
  socialPlatform?: ApiSocialPlatform
  note?: string | null
  customerName?: string | null
  customerPhone?: string | null
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

/* ---- suppliers (9 Nov) ------------------------------------------------------------------------- */

/** `GET /suppliers`. Admin or manager only. */
export interface ApiSupplier {
  id: string
  name: string
  phone: string | null
  note: string | null
  isActive: boolean
  createdAt: string
}

export interface CreateSupplierInput {
  name: string
  phone: string
  note?: string
}

export interface UpdateSupplierInput {
  name?: string
  phone?: string
  note?: string
  isActive?: boolean
}

export interface ListSuppliersParams {
  search?: string
  active?: boolean
  limit?: number
  offset?: number
}

export interface GoodsReceiptLineInput {
  skuId: string
  quantity: number
  unitCost: string | number
}

/**
 * `POST /goods-receipts`.
 *
 * Name the supplier **either** by `supplierId` (picked from `GET /suppliers`,
 * preferred since 9 Nov) **or** by `supplierName`, which still works for one
 * typed in by hand. `supplierInvoiceNumber` became optional on 9 Nov: a
 * delivery that arrives with no paperwork no longer needs an invented number.
 */
export interface CreateGoodsReceiptInput {
  supplierId?: string
  supplierName?: string
  supplierInvoiceNumber?: string
  invoiceDate?: string
  currency?: string
  note?: string
  lines: GoodsReceiptLineInput[]
}

export interface ApiGoodsReceiptSummary {
  id: string
  reference: string
  warehouse: { id: string; code: string; name: string }
  /** The supplier record, when the receipt was filed against one (9 Nov). */
  supplier?: { id: string; phone: string | null } | null
  /** The supplier's name **on the day**, kept even if the record is renamed later. */
  supplierName: string
  /** Optional since 9 Nov: `null` when the delivery came with no invoice number. */
  supplierInvoiceNumber: string | null
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
  /** Free-text match on the name kept on the receipt. */
  supplier?: string
  /** Every receipt filed against one supplier record (9 Nov). */
  supplierId?: string
  invoiceNumber?: string
  skuId?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

/**
 * `b2b`: the warehouse invoices a branch for what it sent. `b2b_return`: a
 * branch invoices the warehouse for goods it sent back. Both are raised as
 * drafts when a transfer is dispatched (a branch-to-branch transfer gets one
 * of each). `b2c`: the invoice of a till sale.
 */
export type ApiInvoiceKind = 'b2b' | 'b2b_return' | 'b2c'
export type ApiInvoiceStatus = 'draft' | 'final' | 'void'

export type CreateInvoiceInput =
  | { transferId: string; note?: string; invoiceKind?: 'b2b' | 'b2b_return' }
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
  /** B2C from sale: rate frozen at checkout. B2B usually null. */
  exchangeRate?: number | null
  totalLbp?: number | null
  note: string | null
  issuedBy: { id: string; name: string | null }
  createdAt: string
  finalizedAt: string | null
  voided: { at: string; by: { id: string; name: string | null }; reason: string } | null
  lineCount: number
}

/**
 * Where the unit price on a supply invoice line came from (9 Nov).
 *
 * A supply invoice is priced at **cost**, not at the shop's selling price.
 *
 * - `cost`: the warehouse's average purchase cost.
 * - `manual`: typed into the draft with `PATCH /invoices/:id`.
 * - `missing`: no cost is known, so the price is `0.00`. Warn on these lines:
 *   `POST /invoices/:id/finalize` answers **409** while one is left.
 * - `sale`: the line comes from a sale (b2c invoice).
 * - `null`: an invoice raised before this field existed.
 */
export type ApiInvoicePriceSource = 'cost' | 'manual' | 'missing' | 'sale' | null

export interface ApiInvoiceLine {
  lineNo: number
  sku: { id: string; code: string; barcode?: string | null }
  /** Primary variant barcode when the API includes it on the invoice line. */
  barcode?: string | null
  description: string
  quantity: number
  unitPrice: string
  discount: string
  lineTotal: string
  /** Added 9 Nov; `undefined` on an older server. */
  priceSource?: ApiInvoicePriceSource
}

export type ApiInvoicePaymentCurrency = 'USD' | 'LBP'

export interface ApiInvoicePayment {
  method: string
  amount: string
  reference: string | null
  currency?: ApiInvoicePaymentCurrency
  lbpAmount?: number | null
  changeLbp?: number | null
}

export interface ApiInvoice extends ApiInvoiceSummary {
  lines: ApiInvoiceLine[]
  payments: ApiInvoicePayment[]
}

export interface ListInvoicesParams {
  kind?: ApiInvoiceKind
  status?: ApiInvoiceStatus
  branchId?: string
  search?: string
  /** 9 Nov: returns exactly that transfer's invoice (0 or 1). Add `status: 'void'` to see voided ones. */
  transferId?: string
  /** 9 Nov: returns exactly that sale's invoice (0 or 1). */
  saleId?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

/* ---- store settings (9 Nov) --------------------------------------------------------------------- */

/**
 * `GET /settings`, readable by any signed-in user; `PUT /settings` needs admin
 * or manager (`settings.manage`).
 *
 * This replaces the device-local exchange rate and the return window that used
 * to be a constant in the UI. One row for the whole business, so every till
 * shows the same figures.
 */
export interface ApiSettings {
  /** Whole pounds. `null` when no rate has been set: show USD only. */
  exchangeRateUsdLbp: number | null
  /** How many days a sale may be returned within. Read this, never hardcode 14. */
  returnPeriodDays: number
  /** Default hold for a social-media order. */
  defaultReservationDays: number
  /** When true, `POST /sales` answers 409 unless the branch has an open cash session. */
  requireOpenCashSession: boolean
}

/**
 * Partial body for `PUT /settings`. Whole numbers only, and an unknown key is a
 * **400** — so send only the fields that changed. `exchangeRateUsdLbp: null`
 * clears the rate.
 */
export interface UpdateSettingsInput {
  exchangeRateUsdLbp?: number | null
  returnPeriodDays?: number
  defaultReservationDays?: number
  requireOpenCashSession?: boolean
}

/* ---- cash sessions, "the drawer" (9 Nov) -------------------------------------------------------- */

export type CashSessionStatus = 'open' | 'closed'

/** Cash out of the drawer, or cash into it, outside of a sale. */
export type CashMovementDirection = 'in' | 'out'

export interface ApiCashMovement {
  id: string
  direction: CashMovementDirection
  amount: string
  reason: string
  at: string
  by?: { id: string; name: string | null }
}

/** One person taking the drawer from another. Counted by the person TAKING it. */
export interface ApiCashHandover {
  id: string
  at: string
  /** Who handed it over. */
  from: { id: string; name: string | null }
  /** Who counted and took it. */
  to: { id: string; name: string | null }
  countedCash: string
  expectedCash: string
  difference: string
  note: string | null
}

/** A manager's correction to a closed session. The original closing is kept. */
export interface ApiCashCorrection {
  id: string
  field: 'openingCash' | 'countedCash' | 'cashRemoved'
  value: string
  reason: string
  at: string
  by?: { id: string; name: string | null }
}

export interface ApiCashClosing {
  at: string
  /** Omitted on some older cash-session payloads. */
  by?: { id: string; name: string | null }
  countedCash: string
  cashRemoved: string
  /** counted - removed: what stays in the drawer for tomorrow. */
  cashLeft: string
  expectedCash: string
  difference: string
  differenceNote: string | null
}

/**
 * **Expected cash** = opening + cash payments + cash in - cash out.
 *
 * Whish never touches the drawer, so `whishPayments` is reported but is not in
 * `expectedCash`.
 */
export interface ApiCashSessionTotals {
  salesCount: number
  salesTotal: string
  cashPayments: string
  whishPayments: string
  cashIn: string
  cashOut: string
  expectedCash: string
}

/** What one person sold during the session. */
export interface ApiCashSessionByUser {
  user: { id: string; name: string | null }
  salesCount: number
  salesTotal: string
  cashPayments: string
  whishPayments: string
}

/** A manager's sign-off on a flagged session. */
export interface ApiCashSessionReview {
  /** Why the session wants a manager's eye, e.g. a count that did not match. */
  flagged: boolean
  reviewedAt: string | null
  reviewedBy: { id: string; name: string | null } | null
  note: string | null
}

export interface ApiCashSessionSummary {
  id: string
  status: CashSessionStatus
  branch: ApiLocation
  openingCash: string
  note: string | null
  openedAt: string
  openedBy: { id: string; name: string | null }
  closedAt: string | null
  /** Present on detail and current session; list may omit until enriched. */
  totals?: ApiCashSessionTotals
  review: ApiCashSessionReview
}

export interface ApiCashSession extends ApiCashSessionSummary {
  byUser: ApiCashSessionByUser[]
  movements: ApiCashMovement[]
  handovers: ApiCashHandover[]
  corrections: ApiCashCorrection[]
  /** The closing as it was first recorded. */
  closing: ApiCashClosing | null
  /** The same closing with every correction applied. Show both side by side. */
  effective: ApiCashClosing | null
}

export interface OpenCashSessionInput {
  branchId: string
  openingCash: string | number
  note?: string
}

export interface CashMovementInput {
  direction: CashMovementDirection
  amount: string | number
  reason: string
}

/** The note is **required** when the count differs from `totals.expectedCash` (400 otherwise). */
export interface CashHandoverInput {
  countedCash: string | number
  note?: string
}

/**
 * `differenceNote` is required when the count differs from the expected cash,
 * but a difference never blocks the closing.
 */
export interface CloseCashSessionInput {
  countedCash: string | number
  cashRemoved?: string | number
  differenceNote?: string
}

export interface CashCorrectionInput {
  field: ApiCashCorrection['field']
  value: string | number
  reason: string
}

export interface ListCashSessionsParams {
  branchId?: string
  status?: CashSessionStatus
  /** `'flagged'` is the manager's "to review" list. */
  review?: 'flagged'
  from?: string
  to?: string
  limit?: number
  offset?: number
}

/* ------------------------------------------------------------------ *
 * Customer returns: `/returns` (BL-04 rules 31 to 37)
 * ------------------------------------------------------------------ */

/**
 * Where a return has got to.
 *
 * `in_custody` means the shop is holding goods that are still the **customer's**
 * — no stock has moved. Approval is the single moment the units enter the
 * business's own on-hold bucket; `release` is what later puts them on the shelf.
 * A rejected return waits at `rejected` until the customer collects it, which
 * is `handed_back`.
 */
export type ApiReturnStatus = 'in_custody' | 'approved' | 'rejected' | 'handed_back'

/**
 * Whether the shop physically has the goods.
 *
 * A customer who starts a return but keeps the item is `customer_keeps`, and
 * the server **refuses to approve** that return until `POST /returns/:id/custody`
 * records that the goods came in. Nothing is refunded for an item nobody has
 * seen.
 */
export type ApiReturnCustody = 'with_branch' | 'customer_keeps'

/**
 * The condition recorded on each returned unit.
 *
 * These four are the server's list. They do **not** change the refund: rule 35
 * is the amount actually paid, and the condition only tells the manager what to
 * do with the unit when deciding whether to release it. There is no retention
 * percentage and no grade haircut.
 */
export type ApiReturnCondition = 'as_new' | 'minor_flaws' | 'needs_repair' | 'damaged'

export interface ApiReturnLine {
  id: string
  saleLineId: string
  sku: { id: string; code: string }
  description: string
  quantity: number
  condition: ApiReturnCondition
  /** Fixed at approval: what was paid for these units. `null` until then. */
  refundValue: string | null
  /** Moved from hold to sellable by `POST /returns/:id/release`. */
  releasedQty: number
  /** Approved and not yet released. A release can never exceed this. */
  onHold: number
}

export interface ApiReturnRefundPayment {
  id: string
  method: 'cash' | 'whish'
  amount: string
  recipient: string
  /** Whish only — the server rejects a reference on a cash refund. */
  reference: string | null
  by: { id: string; name: string | null }
  at: string
}

/**
 * The money owed, fixed when the manager approves and paid separately.
 *
 * `null` while the return is in custody, and on a rejected one: there is no
 * refund to speak of. `outstanding` is what may still be paid, and the server
 * refuses a payment above it, so read it rather than subtracting by hand.
 */
export interface ApiReturnRefund {
  total: string
  paid: string
  outstanding: string
  status: 'pending' | 'paid'
  payments: ApiReturnRefundPayment[]
}

/**
 * An exchange: this return linked to the replacement sale (rule 36).
 *
 * `net` is the new sale's total less the refund. Positive means the customer
 * pays the difference (`customer_pays`), negative means the shop owes it
 * (`business_pays`). Linking an exchange neither pays the refund nor releases
 * the goods — those stay separate acts.
 */
export interface ApiReturnExchange {
  saleId: string
  saleReference: string
  saleTotal: string
  refundTotal: string
  net: string
  direction: 'customer_pays' | 'business_pays' | 'even'
  linkedBy: { id: string; name: string | null }
  linkedAt: string
}

export interface ApiReturn {
  id: string
  /** `RET-00000001`, issued by the server. */
  reference: string
  status: ApiReturnStatus
  custody: ApiReturnCustody
  sale: { id: string; reference: string; branch: { id: string; name: string }; soldAt: string }
  /** Where the goods were handed in — not necessarily where they were sold. */
  receivingBranch: { id: string; code: string; name: string }
  reason: string
  note: string | null
  /** A manager's written exception for a return past the return window. */
  lateExceptionReason: string | null
  receivedBy: { id: string; name: string | null }
  receivedAt: string
  /** Who approved or rejected it, and why. `null` while in custody. */
  decision: { by: { id: string; name: string | null }; at: string; reason: string | null } | null
  /** Who collected a rejected return, and who handed it over. */
  handback: { to: string; by: { id: string; name: string | null }; at: string } | null
  lines: ApiReturnLine[]
  exchange: ApiReturnExchange | null
  refund: ApiReturnRefund | null
}

/** A row of `GET /returns`. `refundTotal` is `null` until the return is approved. */
export interface ApiReturnSummary {
  id: string
  reference: string
  status: ApiReturnStatus
  saleReference: string
  receivingBranch: { id: string; name: string }
  receivedAt: string
  units: number
  refundTotal: string | null
  refundOutstanding: string | null
}

export interface ApiReturnableSaleLine {
  saleLineId: string
  skuId: string
  skuCode: string
  description: string
  sold: number
  /** Units already approved back. */
  returned: number
  /** Units sitting in custody on an open return — they count against the limit. */
  inCustody: number
  /** `sold - returned - inCustody`: what this return may take. */
  returnable: number
  lineTotal: string
}

/**
 * `GET /returns/eligible?sale=` — the sale a return starts from.
 *
 * The lookup takes either the sale's id or its printed number (`S-00000012`,
 * case-insensitively), because the customer arrives holding a receipt and a
 * return may be taken at **any** branch.
 *
 * `withinPeriod: false` does not end the matter: a manager may still receive
 * the goods by sending `lateException.reason`. An employee cannot.
 */
export interface ApiReturnableSale {
  sale: {
    id: string
    reference: string
    status: string
    branch: { id: string; name: string }
    soldAt: string
    businessDate: string
    total: string
  }
  /** From `GET /settings`, so the window is the shop's, not a constant. */
  returnPeriodDays: number
  daysSinceSale: number
  withinPeriod: boolean
  lines: ApiReturnableSaleLine[]
}

export interface CreateReturnInput {
  saleId: string
  /** The branch taking the goods in. The warehouse is refused. */
  receivingBranchId: string
  /** The server defaults this to `with_branch`. */
  custody?: ApiReturnCustody
  /** 3 to 200 characters. */
  reason: string
  /** At most 200 characters. */
  note?: string
  lines: { skuId: string; quantity: number; condition: ApiReturnCondition }[]
  /** Manager-only, and only needed past the return window. 3 to 200 characters. */
  lateException?: { reason: string }
}

/** An optional note on the approval; the decision itself needs no body. */
export interface ApproveReturnInput {
  reason?: string
}

/** Rejecting **requires** a reason (3 to 200 characters). */
export interface RejectReturnInput {
  reason: string
}

/** Who collected the goods (2 to 100 characters). */
export interface HandbackReturnInput {
  recipient: string
}

/** Omit `lines` to release everything still on hold. */
export interface ReleaseReturnInput {
  lines?: { returnLineId: string; quantity: number }[]
}

export interface RefundPaymentInput {
  method: 'cash' | 'whish'
  /** Decimal string. Above zero, and never more than `refund.outstanding`. */
  amount: string
  /** Who received the money (2 to 100 characters). */
  recipient: string
  /** Whish only — sending one with `cash` is a 400. */
  reference?: string
}

/** The replacement sale. Made at the receiving branch, after the goods came in. */
export interface LinkExchangeInput {
  saleId: string
}

export interface ListReturnsParams {
  /** The receiving branch. */
  branchId?: string
  saleId?: string
  status?: ApiReturnStatus
  from?: string
  to?: string
  limit?: number
  offset?: number
}

/* ------------------------------------------------------------------ *
 * Cost and profit: `/costs`
 * ------------------------------------------------------------------ */

/**
 * `GET /costs/skus/:id` — what a piece costs. Admin or manager only.
 *
 * Two independent figures, both **four-decimal** strings (`"9.5000"`):
 * `catalogCost` is what a manager typed, and `warehouseAverageCost` is what the
 * warehouse actually paid on average across its receipts. A supply invoice
 * prices from the warehouse average and falls back to the catalog cost when the
 * warehouse has none yet (opening stock), which is what stops a line reading
 * `priceSource: 'missing'`.
 *
 * This is the server-side replacement for the device-local
 * `bitar:catalog-costs:v1` store, where a cost typed on one laptop was
 * invisible everywhere else.
 */
export interface ApiSkuCost {
  skuId: string
  skuCode: string
  catalogCost: string | null
  warehouseAverageCost: string | null
}

/** `PUT /costs/skus/:id`. `null` clears the catalog cost. Max 100,000.00. */
export interface SetSkuCostInput {
  unitCost: string | number | null
}

/**
 * One branch's trading result over the period.
 *
 * `revenue`, `cost` and `profit` are what was **sold**. A line whose cost was
 * never known is not guessed: its revenue is set aside in `unknownCostRevenue`,
 * so `profit` is only ever the margin on goods whose cost is known. Reading
 * `revenue - cost` as the margin would overstate it by exactly that amount.
 *
 * `refunds` and `returnedCost` are the returns approved in the period, counted
 * at the branch that handed the money back. `netProfit` is therefore the profit
 * on what the customers actually kept.
 */
export interface ApiProfitRow {
  branchId: string
  revenue: string
  cost: string
  profit: string
  unknownCostRevenue: string
  salesCount: number
  refunds: string
  returnedCost: string
  netRevenue: string
  netProfit: string
}

export type ApiProfitTotals = Omit<ApiProfitRow, 'branchId'>

/** `GET /costs/profit`. Needs `reports.financial` **and** an admin or manager role. */
export interface ApiProfitReport {
  from: string
  to: string
  totals: ApiProfitTotals
  byBranch: ApiProfitRow[]
}

export interface ProfitReportParams {
  branchId?: string
  from?: string
  to?: string
}
