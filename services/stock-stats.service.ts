import { readDb, type MockDb } from '@/mocks/store'
import { branchStockItems } from '@/services/stock-api.service'
import type { ApiStockItem } from '@/lib/api/types'
import type { Branch, BranchScope, InventoryStats } from '@/types'

/*
 * The figures behind the stat cards, read from : the server owns
 * the quantities, and nothing here is held locally.
 */

export interface StockOverview {
  stats: InventoryStats
}

interface BranchItems {
  branch: Branch
  items: ApiStockItem[]
}

/** One read per branch in scope:  takes a branch and has no all-branch form. */
async function itemsPerBranch(branches: Branch[]): Promise<BranchItems[]> {
  return Promise.all(branches.map(async (branch) => ({ branch, items: await branchStockItems(branch.id) })))
}

/** A location counts for a SKU once it holds some of it; none means it is not sold there. */
function carriedOnly(perBranch: BranchItems[]): BranchItems[] {
  return perBranch.map(({ branch, items }) => ({
    branch,
    items: items.filter((item) => item.sellable + item.nonSellable + item.inTransit > 0),
  }))
}

function statsFrom(db: MockDb, visibleBranches: Branch[], perBranch: BranchItems[]): InventoryStats {
  const perVariant = new Map<string, number>()
  let stockUnits = 0

  for (const { items } of perBranch) {
    for (const item of items) {
      stockUnits += item.sellable + item.nonSellable
      perVariant.set(item.sku.id, (perVariant.get(item.sku.id) ?? 0) + item.sellable)
    }
  }

  let inStockVariantCount = 0
  for (const available of perVariant.values()) {
    if (available > 0) inStockVariantCount += 1
  }

  return {
    branchCount: visibleBranches.length,
    warehouseCount: visibleBranches.filter((branch) => branch.id === db.warehouseId).length,
    productCount: db.products.filter((product) => !product.archived).length,
    variantCount: perVariant.size,
    inStockVariantCount,
    stockUnits,
  }
}

/** The stat cards from a single read of . */
export async function stockOverviewFromApi(scope: BranchScope): Promise<StockOverview> {
  const { listBranches } = await import('@/services/branches.service')
  const visibleBranches = await listBranches(scope)
  const db = readDb()
  const perBranch = carriedOnly(await itemsPerBranch(visibleBranches))
  return { stats: statsFrom(db, visibleBranches, perBranch) }
}
