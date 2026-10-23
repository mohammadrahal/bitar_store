export type BranchType = 'store' | 'warehouse'

export interface Branch {
  id: string
  name: string
  code: string
  address: string
  type: BranchType
  createdAt: string
}

export interface Product {
  id: string
  sku: string
  name: string
  category: string
  price: number
  /** Minimum on-hand units per branch before the item is flagged as low stock. */
  reorderPoint: number
  createdAt: string
}

export interface StockLevel {
  productId: string
  branchId: string
  onHand: number
  reserved: number
}

export type MovementType = 'stock_in' | 'stock_out' | 'transfer' | 'adjustment'

export type TransferStatus = 'in_transit' | 'received' | 'cancelled'

export interface Movement {
  id: string
  type: MovementType
  productId: string
  /** Snapshot so history stays readable after a product is renamed or deleted. */
  productName: string
  sku: string
  /** Source branch for transfers, affected branch otherwise. */
  branchId: string
  toBranchId?: string
  /**
   * Signed on-hand delta at `branchId` for stock in/out and adjustments.
   * Always positive (units moved) for transfers.
   */
  qty: number
  reference: string
  note?: string
  user: string
  createdAt: string
  status?: TransferStatus
  completedAt?: string
}

export interface Settings {
  userName: string
  currency: string
}

export interface InventoryState {
  version: 1
  branches: Branch[]
  products: Product[]
  stock: StockLevel[]
  movements: Movement[]
  settings: Settings
}

export type StockStatus = 'healthy' | 'low' | 'out'

export type ActionResult = { ok: true } | { ok: false; error: string }

export const ALL_BRANCHES = 'all'
export type BranchScope = typeof ALL_BRANCHES | string
