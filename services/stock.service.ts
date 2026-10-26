import { delay, delayedFailure } from '@/lib/delay'
import { readDb, writeDb, type MockDb } from '@/mocks/store'
import {
  ALL_BRANCHES,
  type BranchScope,
  type BranchStockRow,
  type InventoryStats,
  type LowStockRow,
  type StockStatus,
} from '@/types'

function inScope(branchId: string, scope: BranchScope) {
  return scope === ALL_BRANCHES || branchId === scope
}

function statusOf(quantity: number, lowStockAt: number): StockStatus {
  if (quantity === 0) return 'out'
  return quantity <= lowStockAt ? 'low' : 'healthy'
}

function scopedStock(db: MockDb, scope: BranchScope) {
  return db.stock.filter((level) => inScope(level.branchId, scope))
}

/** Total units a branch currently holds, used to guard branch deletion. */
export async function getBranchStockUnits(branchId: string): Promise<number> {
  const units = readDb()
    .stock.filter((level) => level.branchId === branchId)
    .reduce((total, level) => total + level.quantity, 0)
  return delay(units)
}

export async function getInventoryStats(scope: BranchScope = ALL_BRANCHES): Promise<InventoryStats> {
  const db = readDb()
  const levels = scopedStock(db, scope)

  const inStock = new Set<string>()
  let stockUnits = 0
  let lowStockCount = 0
  let outOfStockCount = 0

  for (const level of levels) {
    stockUnits += level.quantity
    if (level.quantity > 0) inStock.add(level.variantId)
    const status = statusOf(level.quantity, level.lowStockAt)
    if (status === 'out') outOfStockCount += 1
    else if (status === 'low') lowStockCount += 1
  }

  return delay({
    branchCount: db.branches.filter((branch) => inScope(branch.id, scope)).length,
    productCount: db.products.length,
    variantCount: db.variants.length,
    inStockVariantCount: inStock.size,
    stockUnits,
    lowStockCount,
    outOfStockCount,
  })
}

/** Variants at or below their low-stock threshold, emptiest first. */
export async function listLowStock(scope: BranchScope = ALL_BRANCHES): Promise<LowStockRow[]> {
  const db = readDb()
  const rows: LowStockRow[] = []

  for (const level of scopedStock(db, scope)) {
    const status = statusOf(level.quantity, level.lowStockAt)
    if (status === 'healthy') continue

    const variant = db.variants.find((candidate) => candidate.id === level.variantId)
    const product = variant && db.products.find((candidate) => candidate.id === variant.productId)
    const branch = db.branches.find((candidate) => candidate.id === level.branchId)
    if (!variant || !product) continue

    rows.push({
      variantId: variant.id,
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      productId: product.id,
      productName: product.name,
      category: product.category,
      branchId: level.branchId,
      branchName: branch?.name ?? 'Unknown branch',
      quantity: level.quantity,
      lowStockAt: level.lowStockAt,
      status,
    })
  }

  rows.sort(
    (a, b) =>
      a.quantity - b.quantity ||
      a.productName.localeCompare(b.productName) ||
      a.branchName.localeCompare(b.branchName),
  )
  return delay(rows)
}

/** Everything a branch holds, emptiest first, for the branch stock list. */
export async function listBranchStock(branchId: string): Promise<BranchStockRow[]> {
  const db = readDb()
  const rows: BranchStockRow[] = []

  for (const level of db.stock) {
    if (level.branchId !== branchId) continue
    const variant = db.variants.find((candidate) => candidate.id === level.variantId)
    const product = variant && db.products.find((candidate) => candidate.id === variant.productId)
    if (!variant || !product) continue

    rows.push({
      variantId: variant.id,
      sku: variant.sku,
      barcode: variant.barcode,
      size: variant.size,
      color: variant.color,
      productId: product.id,
      productName: product.name,
      category: product.category,
      quantity: level.quantity,
      lowStockAt: level.lowStockAt,
      status: statusOf(level.quantity, level.lowStockAt),
      costPrice: product.costPrice,
      sellPrice: product.sellPrice,
    })
  }

  rows.sort(
    (a, b) =>
      a.quantity - b.quantity || a.productName.localeCompare(b.productName) || a.sku.localeCompare(b.sku),
  )
  return delay(rows)
}

export interface LowStockAtInput {
  variantId: string
  branchId: string
  lowStockAt: number
}

/**
 * The threshold is a policy number, not a fact, so it is the one stock value a
 * person sets by hand. The quantity beside it is only ever moved by a document.
 */
export async function setLowStockAt(input: LowStockAtInput): Promise<number> {
  if (!Number.isInteger(input.lowStockAt) || input.lowStockAt < 0) {
    return delayedFailure('A threshold must be a whole number of units, 0 or more.')
  }

  const saved = writeDb((db) => {
    const level = db.stock.find(
      (candidate) => candidate.variantId === input.variantId && candidate.branchId === input.branchId,
    )
    if (!level) return null
    level.lowStockAt = input.lowStockAt
    return level.lowStockAt
  })

  if (saved === null) return delayedFailure('That variant is not stocked at this branch.')
  return delay(saved)
}

/** On-hand quantity per variant at one branch, keyed by variant id. */
export async function getBranchStockMap(branchId: string): Promise<Record<string, number>> {
  const map: Record<string, number> = {}
  for (const level of readDb().stock) {
    if (level.branchId === branchId) map[level.variantId] = level.quantity
  }
  return delay(map)
}
