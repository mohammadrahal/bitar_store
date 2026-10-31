import { readDb, type MockDb } from '@/mocks/store'
import { visibleBranchIds, visibleScope } from '@/services/mock-ledger'
import { branchStockItems, styleStockItems } from '@/services/stock-api.service'
import { ALL_BRANCHES, type Branch, type BranchScope, type Units } from '@/types'

/*
 * Units behind the catalog screens, summed from `GET /stock` over the
 * locations in scope. The server owns the quantities, so nothing here reads
 * the local store beyond the branch list it may see.
 */

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

/** On hand and available per model, for the products list. */
export async function unitsByProduct(scope: BranchScope): Promise<Record<string, Units>> {
  const db = readDb()
  const totals: Record<string, Units> = {}
  for (const branch of branchesIn(db, visibleScope(scope))) {
    for (const item of await branchStockItems(branch.id)) {
      add(totals, item.sku.styleId, item.sellable, item.nonSellable)
    }
  }
  return totals
}

/** The same figures per SKU of one model, for its variant table. */
export async function unitsByVariant(productId: string, scope: BranchScope): Promise<Record<string, Units>> {
  const db = readDb()
  const totals: Record<string, Units> = {}
  for (const branch of branchesIn(db, visibleScope(scope))) {
    for (const item of await styleStockItems(branch.id, productId)) {
      add(totals, item.sku.id, item.sellable, item.nonSellable)
    }
  }
  return totals
}
