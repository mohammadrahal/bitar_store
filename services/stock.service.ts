import { delay, delayedFailure } from '@/lib/delay'
import { isRetired, readDb, writeDb, type MockDb } from '@/mocks/store'
import { availableOf, branchNameOf } from '@/services/mock-ledger'
import {
  ALL_BRANCHES,
  type BranchScope,
  type BranchStockRow,
  type InventoryStats,
  type LowStockRow,
  type StockLevel,
  type StockStatus,
} from '@/types'

function inScope(branchId: string, scope: BranchScope) {
  return scope === ALL_BRANCHES || branchId === scope
}

export function statusOf(available: number, lowStockAt: number): StockStatus {
  if (available === 0) return 'out'
  return available <= lowStockAt ? 'low' : 'healthy'
}

/** Levels in scope for SKUs that are still sold. Archived stock is history, not a gap. */
function liveLevels(db: MockDb, scope: BranchScope): StockLevel[] {
  const live = new Set(db.variants.filter((variant) => !isRetired(db, variant)).map((variant) => variant.id))
  return db.stock.filter((level) => live.has(level.variantId) && inScope(level.branchId, scope))
}

/** Total units a branch currently holds, used to guard branch deletion. */
export async function getBranchStockUnits(branchId: string): Promise<number> {
  const units = readDb()
    .stock.filter((level) => level.branchId === branchId)
    .reduce((total, level) => total + level.quantity, 0)
  return delay(units)
}

/**
 * Low and out of stock are counted once per variant across the scope: a
 * variant empty at two branches is one variant to restock, not two.
 */
export async function getInventoryStats(scope: BranchScope = ALL_BRANCHES): Promise<InventoryStats> {
  const db = readDb()
  const perVariant = new Map<string, { available: number; threshold: number }>()
  let stockUnits = 0

  for (const level of liveLevels(db, scope)) {
    stockUnits += level.quantity
    const entry = perVariant.get(level.variantId) ?? { available: 0, threshold: 0 }
    entry.available += availableOf(level)
    entry.threshold = Math.max(entry.threshold, level.lowStockAt)
    perVariant.set(level.variantId, entry)
  }

  let lowStockCount = 0
  let outOfStockCount = 0
  let inStockVariantCount = 0
  for (const { available, threshold } of perVariant.values()) {
    const status = statusOf(available, threshold)
    if (status === 'out') outOfStockCount += 1
    else if (status === 'low') lowStockCount += 1
    if (available > 0) inStockVariantCount += 1
  }

  const branches = db.branches.filter((branch) => inScope(branch.id, scope))
  return delay({
    branchCount: branches.length,
    warehouseCount: branches.filter((branch) => branch.id === db.warehouseId).length,
    productCount: db.products.filter((product) => !product.archived).length,
    variantCount: perVariant.size,
    inStockVariantCount,
    stockUnits,
    lowStockCount,
    outOfStockCount,
  })
}

/** Variant-location pairs at or below their threshold, emptiest first. */
export async function listLowStock(scope: BranchScope = ALL_BRANCHES): Promise<LowStockRow[]> {
  const db = readDb()
  const rows: LowStockRow[] = []

  for (const level of liveLevels(db, scope)) {
    const available = availableOf(level)
    const status = statusOf(available, level.lowStockAt)
    if (status === 'healthy') continue

    const variant = db.variants.find((candidate) => candidate.id === level.variantId)
    const product = variant && db.products.find((candidate) => candidate.id === variant.productId)
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
      branchName: branchNameOf(db, level.branchId),
      quantity: available,
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

  for (const level of liveLevels(db, branchId)) {
    const variant = db.variants.find((candidate) => candidate.id === level.variantId)
    const product = variant && db.products.find((candidate) => candidate.id === variant.productId)
    if (!variant || !product) continue

    const available = availableOf(level)
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
      available,
      lowStockAt: level.lowStockAt,
      status: statusOf(available, level.lowStockAt),
      costPrice: product.costPrice,
      sellPrice: variant.sellPrice,
    })
  }

  rows.sort(
    (a, b) =>
      a.available - b.available || a.productName.localeCompare(b.productName) || a.sku.localeCompare(b.sku),
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

/** Available quantity per variant at one branch, keyed by variant id. */
export async function getBranchStockMap(branchId: string): Promise<Record<string, number>> {
  const map: Record<string, number> = {}
  for (const level of readDb().stock) {
    if (level.branchId === branchId) map[level.variantId] = availableOf(level)
  }
  return delay(map)
}
