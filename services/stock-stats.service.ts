import { canViewAdminWarehouseTools } from '@/lib/api-access'
import type { ApiStockOverview } from '@/lib/api/types'
import { readDb, type MockDb } from '@/lib/catalog-cache/store'
import { useUserStore } from '@/store/user-store'
import { visibleBranchIds, visibleScope } from '@/services/mock-ledger'
import { branchStockItems } from '@/services/stock-api.service'
import { fetchAllStockOverviewCached } from '@/services/warehouse.service'
import type { ApiStockItem } from '@/lib/api/types'
import { ALL_BRANCHES, type Branch, type BranchScope, type InventoryStats } from '@/types'

/*
 * The figures behind the stat cards, read from the server. the server owns
 * the quantities, and nothing here is held locally.
 */

export interface StockOverview {
  stats: InventoryStats
}

interface BranchItems {
  branch: Branch
  items: ApiStockItem[]
}

function canUseStockOverview(): boolean {
  const user = useUserStore.getState().user
  return user ? canViewAdminWarehouseTools(user) : false
}

function branchesInScope(db: MockDb, scope: BranchScope): Branch[] {
  const resolved = visibleScope(scope)
  const visible = new Set(visibleBranchIds(db))
  return db.branches.filter(
    (branch) => visible.has(branch.id) && (resolved === ALL_BRANCHES || branch.id === resolved),
  )
}

/** One read per branch in scope. `GET /stock` has no all-branch form. */
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

function statsFromOverview(db: MockDb, visibleBranches: Branch[], overview: ApiStockOverview): InventoryStats {
  const perVariant = new Map<string, number>()
  let stockUnits = 0

  for (const item of overview.items) {
    const sellable = item.totals.sellable
    const nonSellable = item.totals.nonSellable
    const inTransit = item.totals.inTransit ?? 0
    if (sellable + nonSellable + inTransit === 0) continue
    stockUnits += sellable + nonSellable
    perVariant.set(item.sku.id, (perVariant.get(item.sku.id) ?? 0) + sellable)
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

/** The stat cards from `GET /stock/overview` (admin) or paged `GET /stock` per branch. */
export async function stockOverviewFromApi(scope: BranchScope): Promise<StockOverview> {
  const db = readDb()
  const resolved = visibleScope(scope)
  const visibleBranches = branchesInScope(db, resolved)

  if (canUseStockOverview() && resolved === ALL_BRANCHES) {
    const overview = await fetchAllStockOverviewCached({ activeOnly: true })
    return { stats: statsFromOverview(db, visibleBranches, overview) }
  }

  const perBranch = carriedOnly(await itemsPerBranch(visibleBranches))
  return { stats: statsFrom(db, visibleBranches, perBranch) }
}
