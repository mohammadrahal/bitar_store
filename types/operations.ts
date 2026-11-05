/**
 * The five numbers BL-02 tracks for a variant at a location, as far as the API
 * can report them. `GET /stock` answers with sellable, non-sellable and in
 * transit. On hold mirrors non-sellable from the API. Reserved is draft transfer
 * quantity at the sender (computed client-side until the API exposes it).
 */
export interface Balances {
  /** Sellable plus non-sellable: everything physically there. */
  onHand: number
  /** Kept out of sale by the server: damaged, disputed or set aside. */
  nonSellable: number
  /** Promised on draft transfers leaving this location. */
  reserved: number | null
  /** Non-sellable units (damaged / on hold). */
  onHold: number | null
  /** Sellable now. */
  available: number
  /** Dispatched towards the location and not received yet. */
  inTransit: number
}

/**
 * The one state a variant row leads with. `low` sits between `in_stock` and
 * `out`: there is something on the shelf, but less than the location's minimum.
 */
export type InventoryStatus = 'in_stock' | 'low' | 'out' | 'on_hold' | 'in_transit' | 'archived'

export type InventoryFilter = 'all' | 'low' | 'out' | 'on_hold' | 'in_transit' | 'reserved' | 'archived'

export interface InventoryRow extends Balances {
  /**
   * The highest minimum set for this variant across the locations in scope, or
   * null where none is set or none could be read.
   */
  minQuantity: number | null
  /** Under its minimum at one or more locations in scope. */
  belowMinimum: boolean
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
