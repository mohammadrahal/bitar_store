/**
 * The five numbers BL-02 tracks for a variant at a location, as far as the API
 * can report them. `GET /stock` answers with sellable, non-sellable and in
 * transit; reserved and on hold have no endpoint yet, so they are null and the
 * UI says "not available yet" instead of inventing a figure.
 */
export interface Balances {
  /** Sellable plus non-sellable: everything physically there. */
  onHand: number
  /** Kept out of sale by the server: damaged, disputed or set aside. */
  nonSellable: number
  /** Promised to an approved transfer. Null until the API returns it. */
  reserved: number | null
  /** Set aside by a hold. Null until the API returns it. */
  onHold: number | null
  /** Sellable now. */
  available: number
  /** Dispatched towards the location and not received yet. */
  inTransit: number
}

export type InventoryStatus = 'in_stock' | 'out' | 'on_hold' | 'in_transit' | 'archived'

export type InventoryFilter = 'all' | 'out' | 'on_hold' | 'in_transit' | 'archived'

export interface InventoryRow extends Balances {
  variantId: string
  productId: string
  productName: string
  productCode: string
  variantCode: string
  sku: string
  barcode: string
  size: string
  color: string
  category: string
  archived: boolean
  status: InventoryStatus
}

export interface LocationBalance extends Balances {
  branchId: string
  branchName: string
  isWarehouse: boolean
}

export interface VariantDetail {
  variantId: string
  productId: string
  productName: string
  productCode: string
  sku: string
  barcode: string
  size: string
  color: string
  category: string
  archived: boolean
  totals: Balances
  locations: LocationBalance[]
}

export type SizeSystem = 'letter' | 'numeric' | 'one'

export interface TodayPaymentBucket {
  sales: number
  amount: number
}

/** How a day's takings split across the two payment methods. */
export interface TodayPaymentMix {
  cash: { sales: number; amount: number }
  whish: { sales: number; amount: number }
  split: { sales: number; amount: number; cashAmount: number; whishAmount: number }
}

/** What the till has taken today at the locations in scope. */
export interface OperationsSummary {
  todaySales: number
  todayRevenue: number
  todayMix: TodayPaymentMix
}
