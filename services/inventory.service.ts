import { readDb, type MockDb } from '@/mocks/store'
import { visibleBranchIds, visibleScope } from '@/services/mock-ledger'
import { branchStockItems } from '@/services/stock-api.service'
import {
  ALL_BRANCHES,
  type Balances,
  type BranchScope,
  type InventoryFilter,
  type InventoryRow,
  type InventoryStatus,
  type LocationBalance,
  type VariantDetail,
} from '@/types'

export interface InventoryQuery {
  scope: BranchScope
  filter: InventoryFilter
  search: string
}

/*
 * Balances come from `GET /stock` and nothing else, so this screen and the till
 * never disagree about the same variant at the same location.
 *
 * The API reports three numbers per row: sellable, non-sellable and in transit.
 * Reserved and on-hold have no endpoint yet, so they are reported as null and
 * shown as "not available yet".
 */

function emptyBalances(): Balances {
  return { onHand: 0, nonSellable: 0, reserved: null, onHold: null, available: 0, inTransit: 0 }
}

function statusFor(balances: Balances, archived: boolean): InventoryStatus {
  if (archived) return 'archived'
  if (balances.available === 0 && balances.inTransit === 0) return 'out'
  if (balances.inTransit > 0) return 'in_transit'
  if (balances.nonSellable > 0) return 'on_hold'
  return 'in_stock'
}

function matchesFilter(row: InventoryRow, filter: InventoryFilter) {
  if (filter === 'archived') return row.archived
  if (row.archived) return false
  if (filter === 'out') return row.status === 'out'
  if (filter === 'on_hold') return row.nonSellable > 0
  if (filter === 'in_transit') return row.inTransit > 0
  return true
}

function locationsIn(db: MockDb, scope: BranchScope) {
  const visible = new Set(visibleBranchIds(db))
  return db.branches.filter((branch) => visible.has(branch.id) && (scope === ALL_BRANCHES || branch.id === scope))
}

interface Carried {
  balances: Balances
}

/** `GET /stock` for every location in scope, folded into one row per variant. */
async function carriedByVariant(db: MockDb, scope: BranchScope): Promise<Map<string, Carried>> {
  const byVariant = new Map<string, Carried>()

  for (const location of locationsIn(db, scope)) {
    for (const item of await branchStockItems(location.id)) {
      /* A location that holds none of a SKU does not carry it, so it is not
         listed as out of stock there: it is simply not sold there. */
      if (item.sellable + item.nonSellable + item.inTransit === 0) continue

      const current = byVariant.get(item.sku.id) ?? { balances: emptyBalances() }
      current.balances.onHand += item.sellable + item.nonSellable
      current.balances.nonSellable += item.nonSellable
      current.balances.available += item.sellable
      current.balances.inTransit += item.inTransit
      byVariant.set(item.sku.id, current)
    }
  }
  return byVariant
}

/** One row per variant, its balances summed over the locations in scope. */
export async function listInventory(query: InventoryQuery): Promise<InventoryRow[]> {
  const db = readDb()
  const carried = await carriedByVariant(db, visibleScope(query.scope))
  const term = query.search.trim().toLowerCase()
  const rows: InventoryRow[] = []

  for (const [variantId, { balances }] of carried) {
    const variant = db.variants.find((candidate) => candidate.id === variantId)
    const product = variant && db.products.find((candidate) => candidate.id === variant.productId)
    if (!variant || !product) continue

    const haystack =
      `${product.name} ${product.code} ${variant.sku} ${variant.barcode} ${variant.color} ${variant.size}`.toLowerCase()
    if (term && !haystack.includes(term)) continue

    const archived = product.archived || variant.archived
    const row: InventoryRow = {
      ...balances,
      variantId,
      productId: product.id,
      productName: product.name,
      productCode: product.code,
      variantCode: variant.code,
      sku: variant.sku,
      barcode: variant.barcode,
      size: variant.size,
      color: variant.color,
      category: product.category,
      archived,
      status: statusFor(balances, archived),
    }
    if (matchesFilter(row, query.filter)) rows.push(row)
  }

  rows.sort(
    (a, b) => a.productCode.localeCompare(b.productCode) || a.color.localeCompare(b.color) || a.sku.localeCompare(b.sku),
  )
  return rows
}

export async function getVariantDetail(variantId: string): Promise<VariantDetail> {
  const db = readDb()
  const variant = db.variants.find((candidate) => candidate.id === variantId)
  const product = variant && db.products.find((candidate) => candidate.id === variant.productId)
  if (!variant || !product) throw new Error('This variant no longer exists.')

  const totals = emptyBalances()
  const locations: LocationBalance[] = []

  for (const branch of locationsIn(db, ALL_BRANCHES)) {
    const item = (await branchStockItems(branch.id)).find((candidate) => candidate.sku.id === variantId)
    const balances: Balances = {
      onHand: (item?.sellable ?? 0) + (item?.nonSellable ?? 0),
      nonSellable: item?.nonSellable ?? 0,
      reserved: null,
      onHold: null,
      available: item?.sellable ?? 0,
      inTransit: item?.inTransit ?? 0,
    }
    totals.onHand += balances.onHand
    totals.nonSellable += balances.nonSellable
    totals.available += balances.available
    totals.inTransit += balances.inTransit

    locations.push({
      ...balances,
      branchId: branch.id,
      branchName: branch.name,
      isWarehouse: branch.id === db.warehouseId,
    })
  }

  locations.sort((a, b) => Number(b.isWarehouse) - Number(a.isWarehouse) || a.branchName.localeCompare(b.branchName))

  return {
    variantId,
    productId: product.id,
    productName: product.name,
    productCode: product.code,
    sku: variant.sku,
    barcode: variant.barcode,
    size: variant.size,
    color: variant.color,
    category: product.category,
    archived: product.archived || variant.archived,
    totals,
    locations,
  }
}
