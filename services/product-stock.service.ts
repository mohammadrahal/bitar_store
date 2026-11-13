import { canViewAdminWarehouseTools } from '@/lib/api-access'
import type { ApiStockOverview } from '@/lib/api/types'
import { readDb, type MockDb } from '@/lib/catalog-cache/store'
import { visibleBranchIds, visibleScope } from '@/services/mock-ledger'
import { branchStockItems, styleStockItems } from '@/services/stock-api.service'
import { fetchAllStockOverviewCached, fetchStockOverview } from '@/services/warehouse.service'
import { useUserStore } from '@/store/user-store'
import { ALL_BRANCHES, type Branch, type BranchScope, type Units } from '@/types'

const PAGE = 200

function canUseStockOverview(): boolean {
  const user = useUserStore.getState().user
  return user ? canViewAdminWarehouseTools(user) : false
}

function branchesIn(db: MockDb, scope: BranchScope): Branch[] {
  const visible = new Set(visibleBranchIds(db))
  return db.branches.filter((branch) => visible.has(branch.id) && (scope === ALL_BRANCHES || branch.id === scope))
}

function add(totals: Record<string, Units>, key: string, sellable: number, nonSellable: number): void {
  const entry = totals[key] ?? { onHand: 0, available: 0 }
  entry.onHand += sellable + nonSellable
  entry.available += sellable
  totals[key] = entry
}

function quantitiesForScope(
  item: ApiStockOverview['items'][number],
  scope: BranchScope,
): { sellable: number; nonSellable: number } {
  if (scope === ALL_BRANCHES) {
    return { sellable: item.totals.sellable, nonSellable: item.totals.nonSellable }
  }
  const loc = item.locations.find((row) => row.branchId === scope)
  return { sellable: loc?.sellable ?? 0, nonSellable: loc?.nonSellable ?? 0 }
}

async function unitsByProductFromOverview(scope: BranchScope): Promise<Record<string, Units>> {
  const overview = await fetchAllStockOverviewCached({ activeOnly: true })
  const totals: Record<string, Units> = {}
  for (const item of overview.items) {
    const q = quantitiesForScope(item, scope)
    add(totals, item.sku.styleId, q.sellable, q.nonSellable)
  }
  return totals
}

async function unitsByVariantFromOverview(productId: string, scope: BranchScope): Promise<Record<string, Units>> {
  const totals: Record<string, Units> = {}
  for (let offset = 0; ; offset += PAGE) {
    const page = await fetchStockOverview({ styleId: productId, limit: PAGE, offset, activeOnly: true })
    for (const item of page.items) {
      const q = quantitiesForScope(item, scope)
      add(totals, item.sku.id, q.sellable, q.nonSellable)
    }
    if (page.items.length < PAGE) return totals
  }
}

/** On hand and available per model, for the products list. */
export async function unitsByProduct(scope: BranchScope): Promise<Record<string, Units>> {
  const resolved = visibleScope(scope)
  if (canUseStockOverview()) return unitsByProductFromOverview(resolved)

  const db = readDb()
  const totals: Record<string, Units> = {}
  const pages = await Promise.all(branchesIn(db, resolved).map((branch) => branchStockItems(branch.id)))
  for (const items of pages) {
    for (const item of items) {
      add(totals, item.sku.styleId, item.sellable, item.nonSellable)
    }
  }
  return totals
}

/** The same figures per SKU of one model, for its variant table. */
export async function unitsByVariant(productId: string, scope: BranchScope): Promise<Record<string, Units>> {
  const resolved = visibleScope(scope)
  if (canUseStockOverview()) return unitsByVariantFromOverview(productId, resolved)

  const db = readDb()
  const totals: Record<string, Units> = {}
  const pages = await Promise.all(
    branchesIn(db, resolved).map((branch) => styleStockItems(branch.id, productId)),
  )
  for (const items of pages) {
    for (const item of items) {
      add(totals, item.sku.id, item.sellable, item.nonSellable)
    }
  }
  return totals
}
