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

export interface ApiBranch {
  id: string
  code: string
  name: string
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
}

/** PATCH /branches/:id */
export interface UpdateBranchInput {
  name?: string
  isActive?: boolean
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
  standardPrice: string
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

export interface ApiSale {
  id: string
  reference: string
  branchId: string
  soldBy: { id: string; name: string }
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
  amount: string
  tendered?: string
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
