import { readDb, type MockDb } from '@/mocks/store'
import {
  canLoadInventoryFromOverview,
  loadStockOverviewForInventory,
} from '@/services/inventory-overview-source'
import { visibleBranchIds, visibleScope } from '@/services/mock-ledger'
import { mapApiSku, mapApiStyle } from '@/lib/api/map-catalog'
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

function foldStockItem(byVariant: Map<string, Carried>, item: {
  sku: { id: string }
  sellable: number
  nonSellable: number
  inTransit: number
}) {
  if (item.sellable + item.nonSellable + item.inTransit === 0) return
  const current = byVariant.get(item.sku.id) ?? { balances: emptyBalances() }
  current.balances.onHand += item.sellable + item.nonSellable
  current.balances.nonSellable += item.nonSellable
  current.balances.available += item.sellable
  current.balances.inTransit += item.inTransit
  byVariant.set(item.sku.id, current)
}

/** `GET /stock` per location in parallel, folded into one row per variant. */
async function carriedByVariant(db: MockDb, scope: BranchScope): Promise<Map<string, Carried>> {
  const byVariant = new Map<string, Carried>()
  const pages = await Promise.all(locationsIn(db, scope).map((location) => branchStockItems(location.id)))
  for (const items of pages) {
    for (const item of items) foldStockItem(byVariant, item)
  }
  return byVariant
}

async function carriedFromOverview(search: string): Promise<Map<string, Carried>> {
  const overview = await loadStockOverviewForInventory(search)
  const byVariant = new Map<string, Carried>()
  for (const item of overview.items) {
    foldStockItem(byVariant, {
      sku: item.sku,
      sellable: item.totals.sellable,
      nonSellable: item.totals.nonSellable,
      inTransit: item.totals.inTransit,
    })
  }
  return byVariant
}

/** One row per variant, its balances summed over the locations in scope. */
export async function listInventory(query: InventoryQuery): Promise<InventoryRow[]> {
  const db = readDb()
  const scope = visibleScope(query.scope)
  const carried = canLoadInventoryFromOverview(scope)
    ? await carriedFromOverview(query.search)
    : await carriedByVariant(db, scope)
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
  let variant = db.variants.find((candidate) => candidate.id === variantId)
  let product = variant ? db.products.find((candidate) => candidate.id === variant!.productId) : undefined

  const totals = emptyBalances()
  const locations: LocationBalance[] = []

  if (canLoadInventoryFromOverview(ALL_BRANCHES)) {
    if (!variant) throw new Error('This variant no longer exists.')
    const overview = await loadStockOverviewForInventory(variant.sku)
    const item = overview.items.find((row) => row.sku.id === variantId)
    if (!item) throw new Error('This variant no longer exists.')
    variant = mapApiSku(item.sku, item.sku.style.code)
    product = mapApiStyle(
      {
        id: item.sku.styleId,
        code: item.sku.style.code,
        name: item.sku.style.name,
        category: null,
        isActive: item.sku.isActive,
        createdAt: item.sku.createdAt,
        updatedAt: item.sku.updatedAt,
      },
      [variant],
    )
    for (const row of item.locations) {
      const branch = overview.locations.find((loc) => loc.id === row.branchId)
      const balances: Balances = {
        onHand: row.sellable + row.nonSellable,
        nonSellable: row.nonSellable,
        reserved: null,
        onHold: null,
        available: row.sellable,
        inTransit: row.inTransit,
      }
      totals.onHand += balances.onHand
      totals.nonSellable += balances.nonSellable
      totals.available += balances.available
      totals.inTransit += balances.inTransit
      locations.push({
        ...balances,
        branchId: row.branchId,
        branchName: branch?.name ?? row.branchId,
        isWarehouse: branch?.kind === 'warehouse' || row.branchId === db.warehouseId,
      })
    }
  } else {
    if (!variant || !product) throw new Error('This variant no longer exists.')
    const pages = await Promise.all(locationsIn(db, ALL_BRANCHES).map((branch) => branchStockItems(branch.id)))
    locationsIn(db, ALL_BRANCHES).forEach((branch, index) => {
      const item = pages[index]?.find((candidate) => candidate.sku.id === variantId)
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
    })
  }

  if (!variant || !product) throw new Error('This variant no longer exists.')

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
