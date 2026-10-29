import { mapApiSku } from '@/lib/api/map-catalog'
import type { ApiStockItem } from '@/lib/api/types'
import { DEFAULT_LOW_STOCK_AT, readDb, type MockDb } from '@/mocks/store'
import { branchStockItems } from '@/services/stock-api.service'
import { statusOf } from '@/services/stock.service'
import {
  ALL_BRANCHES,
  type Branch,
  type BranchScope,
  type InventoryStats,
  type LowStockRow,
} from '@/types'

/*
 * Figures behind the stat cards and the low-stock list, read from `GET /stock`
 * rather than the local store: the server owns the quantities. Only the
 * low-stock threshold is still local, since the API has no field for it yet.
 *
 * Both come out of one pass over the same pages. They were two queries, which
 * read every branch twice to show two views of the same numbers.
 */

export interface StockOverview {
  stats: InventoryStats
  lowStock: LowStockRow[]
}

interface BranchItems {
  branch: Branch
  items: ApiStockItem[]
}

function branchesInScope(db: MockDb, scope: BranchScope): Branch[] {
  return db.branches.filter((branch) => scope === ALL_BRANCHES || branch.id === scope)
}

/** Thresholds this device has set, keyed `variantId|branchId`. */
function thresholdsOf(db: MockDb): Map<string, number> {
  const map = new Map<string, number>()
  for (const level of db.stock) map.set(`${level.variantId}|${level.branchId}`, level.lowStockAt)
  return map
}

function thresholdOf(thresholds: Map<string, number>, variantId: string, branchId: string): number {
  return thresholds.get(`${variantId}|${branchId}`) ?? DEFAULT_LOW_STOCK_AT
}

/** One read per branch in scope: `GET /stock` takes a branch and has no all-branch form. */
async function itemsPerBranch(db: MockDb, scope: BranchScope): Promise<BranchItems[]> {
  return Promise.all(
    branchesInScope(db, scope).map(async (branch) => ({ branch, items: await branchStockItems(branch.id) })),
  )
}

/**
 * Only the branches that actually carry a SKU count for it. The API cannot yet
 * say "carried here but empty", so an empty row counts only where this device
 * already holds a stock row: a SKU that was never placed at a branch is not out
 * of stock there, it is simply not sold there.
 */
function carriedOnly(perBranch: BranchItems[], thresholds: Map<string, number>): BranchItems[] {
  return perBranch.map(({ branch, items }) => ({
    branch,
    items: items.filter(
      (item) =>
        item.sellable + item.nonSellable + item.inTransit > 0 ||
        thresholds.has(`${item.sku.id}|${branch.id}`),
    ),
  }))
}

/**
 * Low and out of stock are counted once per variant across the scope: a
 * variant empty at two branches is one variant to restock, not two.
 */
function statsFrom(
  db: MockDb,
  scope: BranchScope,
  perBranch: BranchItems[],
  thresholds: Map<string, number>,
): InventoryStats {
  const perVariant = new Map<string, { available: number; threshold: number }>()
  let stockUnits = 0

  for (const { branch, items } of perBranch) {
    for (const item of items) {
      stockUnits += item.sellable + item.nonSellable
      const entry = perVariant.get(item.sku.id) ?? { available: 0, threshold: 0 }
      entry.available += item.sellable
      entry.threshold = Math.max(entry.threshold, thresholdOf(thresholds, item.sku.id, branch.id))
      perVariant.set(item.sku.id, entry)
    }
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

  const branches = branchesInScope(db, scope)
  return {
    branchCount: branches.length,
    warehouseCount: branches.filter((branch) => branch.id === db.warehouseId).length,
    productCount: db.products.filter((product) => !product.archived).length,
    variantCount: perVariant.size,
    inStockVariantCount,
    stockUnits,
    lowStockCount,
    outOfStockCount,
  }
}

/** Variant-location pairs at or below their threshold, emptiest first. */
function lowStockFrom(db: MockDb, perBranch: BranchItems[], thresholds: Map<string, number>): LowStockRow[] {
  const rows: LowStockRow[] = []

  for (const { branch, items } of perBranch) {
    for (const item of items) {
      const available = item.sellable
      const lowStockAt = thresholdOf(thresholds, item.sku.id, branch.id)
      const status = statusOf(available, lowStockAt)
      if (status === 'healthy') continue

      /* Names come from the mirrored catalog, falling back to the style on the
         SKU itself so a row still lists before the catalog has synced. */
      const variant =
        db.variants.find((candidate) => candidate.id === item.sku.id) ?? mapApiSku(item.sku, item.sku.style.code)
      const product = db.products.find((candidate) => candidate.id === variant.productId)

      rows.push({
        variantId: variant.id,
        sku: variant.sku,
        size: variant.size,
        color: variant.color,
        productId: variant.productId,
        productName: product?.name ?? item.sku.style.name,
        category: product?.category ?? '',
        branchId: branch.id,
        branchName: branch.name,
        quantity: available,
        lowStockAt,
        status,
      })
    }
  }

  rows.sort(
    (a, b) =>
      a.quantity - b.quantity ||
      a.productName.localeCompare(b.productName) ||
      a.branchName.localeCompare(b.branchName),
  )
  return rows
}

/** The stat cards and the attention list from a single read of `GET /stock`. */
export async function stockOverviewFromApi(scope: BranchScope): Promise<StockOverview> {
  const db = readDb()
  const thresholds = thresholdsOf(db)
  const perBranch = carriedOnly(await itemsPerBranch(db, scope), thresholds)
  return {
    stats: statsFrom(db, scope, perBranch, thresholds),
    lowStock: lowStockFrom(db, perBranch, thresholds),
  }
}
