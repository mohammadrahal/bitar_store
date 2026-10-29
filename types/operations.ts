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

export type InventoryStatus = 'in_stock' | 'low' | 'out' | 'on_hold' | 'in_transit' | 'archived'

export type InventoryFilter = 'all' | 'low' | 'on_hold' | 'in_transit' | 'archived'

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
  lowStockAt: number
  status: InventoryStatus
}

export interface LocationBalance extends Balances {
  branchId: string
  branchName: string
  isWarehouse: boolean
  lowStockAt: number
}

export type MovementKind =
  | 'sale'
  | 'sale_return'
  | 'purchase'
  | 'purchase_return'
  | 'adjustment_in'
  | 'adjustment_out'
  | 'transfer_out'
  | 'transfer_in'
  | 'reserve'
  | 'release'
  | 'hold'
  | 'hold_release'

export interface Movement {
  id: string
  at: string
  kind: MovementKind
  branchName: string
  /** Signed change to on hand; reservations and holds show their own count. */
  quantity: number
  reference: string
  href?: string
  note?: string
}

/** A stock change that is not a document line: transfers, reservations and holds. */
export interface StockEvent {
  id: string
  at: string
  variantId: string
  branchId: string
  kind: MovementKind
  quantity: number
  reference: string
  /** Transfer or hold id, for the link back. */
  refId?: string
  note?: string
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
  movements: Movement[]
}

export interface ColorOption {
  name: string
  hex: string
}

export type SizeSystem = 'letter' | 'numeric' | 'one'

export type TransferStatus = 'requested' | 'approved' | 'dispatched' | 'partly_received' | 'closed' | 'cancelled'

export interface TransferLine {
  variantId: string
  /** Snapshots, so the transfer reads the same after a rename. */
  sku: string
  productName: string
  size: string
  color: string
  requested: number
  approved: number
  dispatched: number
  /** Accepted into sellable stock at the destination. */
  received: number
  /** Arrived damaged or wrong; went on hold at the destination. */
  damaged: number
  /** Reported missing on arrival and written off. */
  missing: number
}

export interface TransferEvent {
  id: string
  at: string
  actor: string
  message: string
}

export interface Transfer {
  id: string
  /** TR-0042 */
  number: string
  fromBranchId: string
  toBranchId: string
  status: TransferStatus
  lines: TransferLine[]
  events: TransferEvent[]
  /** Documents raised when stock left: the return and sale legs. */
  invoiceIds: string[]
  note?: string
  createdAt: string
  updatedAt: string
}

export interface TransferTotals {
  requested: number
  approved: number
  dispatched: number
  received: number
  damaged: number
  missing: number
  inTransit: number
  /** Approved and not dispatched: still reserved at the sender. */
  stillReserved: number
}

export interface TransferRow extends Transfer {
  fromName: string
  toName: string
  totals: TransferTotals
}

export interface LinkedInvoice {
  id: string
  number: string
  label: string
}

export interface TransferWithLinks extends TransferRow {
  linkedInvoices: LinkedInvoice[]
}

export interface Hold {
  id: string
  variantId: string
  branchId: string
  quantity: number
  reason: string
  /** Placed by hand, or set aside when a transfer arrived damaged. */
  source: 'manual' | 'receipt'
  transferId?: string
  createdAt: string
  createdBy: string
  releasedAt?: string
  releasedBy?: string
}

export interface HoldRow extends Hold {
  productName: string
  sku: string
  size: string
  color: string
  branchName: string
}

export type CountReportStatus = 'open' | 'applied' | 'dismissed'

/** A difference an employee found on the shelf, waiting for a manager. */
export interface CountReport {
  id: string
  variantId: string
  branchId: string
  expected: number
  counted: number
  note: string
  status: CountReportStatus
  reportedBy: string
  createdAt: string
  resolvedBy?: string
  resolvedAt?: string
}

export interface CountReportRow extends CountReport {
  productName: string
  sku: string
  size: string
  color: string
  branchName: string
}

export interface CountSheetRow {
  variantId: string
  productName: string
  sku: string
  size: string
  color: string
  onHand: number
}

export interface ReplenishmentRow {
  variantId: string
  productName: string
  sku: string
  size: string
  color: string
  branchId: string
  branchName: string
  available: number
  inTransit: number
  lowStockAt: number
  /** Units to bring the branch back to twice its threshold. */
  suggested: number
  warehouseAvailable: number
}

export interface OperationsSummary {
  openTransfers: number
  inTransitUnits: number
  onHoldUnits: number
  todaySales: number
  todayRevenue: number
}
