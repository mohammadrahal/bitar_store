import { readDb, type MockDb } from '@/lib/catalog-cache/store'
import {
  canLoadInventoryFromOverview,
  loadStockOverviewForInventory,
} from '@/services/inventory-overview-source'
import { visibleBranchIds, visibleScope } from '@/services/mock-ledger'
import { mapApiSku, mapApiStyle } from '@/lib/api/map-catalog'
import { branchMinimums } from '@/services/reorder-minimums.service'
import { branchStockItems } from '@/services/stock-api.service'
import {
  draftReservedQuantities,
  reservedAtBranch,
  reservedInScope,
} from '@/services/transfer-reservations.service'
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
 * The API reports sellable, non-sellable and in transit. On hold is non-sellable.
 * Reserved is draft transfer lines at the sender, from `GET /transfers?status=draft`.
 */

function emptyBalances(): Balances {
  return { onHand: 0, nonSellable: 0, reserved: 0, onHold: 0, available: 0, inTransit: 0 }
}

/**
 * The last step on every balance row: BL-02 rule 10.
 *
 * `GET /stock` reports `sellable` with no knowledge of our reservations, so
 * `available` arrives as "everything not damaged". Reserved units are promised
 * elsewhere and must come off it, or the till offers stock that is already
 * spoken for (rule 21). On hold is the API's non-sellable bucket, which
 * `sellable` already excludes, so it is not subtracted twice:
 *
 *     available = onHand - onHold - reserved
 *               = (sellable + nonSellable) - nonSellable - reserved
 *               = sellable - reserved
 *
 * Clamped at zero: a reservation larger than what is on the shelf is a real
 * state (stock sold after the draft was written) and must not read as negative
 * stock.
 */
function applyHoldAndReserved(balances: Balances, reserved: number) {
  balances.onHold = balances.nonSellable
  balances.reserved = reserved
  balances.available = Math.max(0, balances.available - reserved)
}

/**
 * The one state a row leads with, most urgent first. `in_transit` is reserved
 * for a variant with nothing sellable yet and something on the way: a variant
 * that is stocked *and* has a delivery coming is simply in stock, and saying
 * "in transit" about it would hide whether it can be sold today.
 */
function statusFor(balances: Balances, archived: boolean, belowMinimum: boolean): InventoryStatus {
  if (archived) return 'archived'
  /* Read off the shelf, not off `available`. Since `available` nets off
     reserved units (rule 10), a variant whose whole sellable balance is
     promised to a transfer would otherwise lead with "out of stock" and send
     someone to reorder what is already in the stockroom. What is physically
     sellable here is `onHand - onHold`, which is the API's own `sellable`. */
  const onShelf = balances.onHand - (balances.onHold ?? balances.nonSellable)
  if (onShelf === 0 && balances.inTransit === 0) return 'out'
  if (onShelf === 0) return 'in_transit'
  if (belowMinimum) return 'low'
  if (balances.nonSellable > 0) return 'on_hold'
  return 'in_stock'
}

function matchesFilter(row: InventoryRow, filter: InventoryFilter, carried: boolean) {
  if (filter === 'archived') return row.archived
  if (row.archived) return false
  /* These two are counted over the whole catalog, so a variant no location has
     ever held still belongs in the list. that is precisely what being out of
     stock means. Every other view shows only what somewhere carries. */
  if (filter === 'out') return row.status === 'out'
  if (filter === 'low') return row.belowMinimum
  if (!carried) return false
  if (filter === 'on_hold') return (row.onHold ?? 0) > 0
  if (filter === 'in_transit') return row.inTransit > 0
  if (filter === 'reserved') return (row.reserved ?? 0) > 0
  return true
}

/** The filters whose answer includes variants nowhere in scope holds. */
function needsWholeCatalog(filter: InventoryFilter) {
  return filter === 'out' || filter === 'low'
}

function locationsIn(db: MockDb, scope: BranchScope) {
  const visible = new Set(visibleBranchIds(db))
  return db.branches.filter((branch) => visible.has(branch.id) && (scope === ALL_BRANCHES || branch.id === scope))
}

interface Position {
  balances: Balances
  /** Highest minimum across the locations in scope, or null where none is set. */
  minQuantity: number | null
  /** Under its minimum at one or more locations in scope. */
  belowMinimum: boolean
  /** Some location in scope holds units of it. */
  carried: boolean
}

function emptyPosition(): Position {
  return { balances: emptyBalances(), minQuantity: null, belowMinimum: false, carried: false }
}

function highestMinimum(current: number | null, candidate: number | null): number | null {
  if (candidate === null) return current
  return current === null ? candidate : Math.max(current, candidate)
}

function foldStockItem(
  byVariant: Map<string, Position>,
  item: { sku: { id: string }; sellable: number; nonSellable: number; inTransit: number },
  minimum: number | null = null,
  belowMinimum = false,
) {
  const units = item.sellable + item.nonSellable + item.inTransit
  if (units === 0 && minimum === null) return
  const current = byVariant.get(item.sku.id) ?? emptyPosition()
  current.balances.onHand += item.sellable + item.nonSellable
  current.balances.nonSellable += item.nonSellable
  current.balances.available += item.sellable
  current.balances.inTransit += item.inTransit
  current.minQuantity = highestMinimum(current.minQuantity, minimum)
  current.belowMinimum = current.belowMinimum || belowMinimum
  current.carried = current.carried || units > 0
  byVariant.set(item.sku.id, current)
}

/** `GET /stock` per location in parallel, folded into one row per variant. */
async function positionsByVariant(db: MockDb, scope: BranchScope): Promise<Map<string, Position>> {
  const byVariant = new Map<string, Position>()
  const locations = locationsIn(db, scope)
  const pages = await Promise.all(
    locations.map(async (location) => ({
      items: await branchStockItems(location.id),
      minimums: await branchMinimums(location.id),
    })),
  )
  for (const { items, minimums } of pages) {
    for (const item of items) {
      const minimum = minimums?.get(item.sku.id) ?? null
      /* The same rule the server applies in `GET /stock/overview`: stock
         already on its way counts, so a branch is not asked to restock twice. */
      const below = minimum !== null && item.sellable + item.inTransit < minimum
      foldStockItem(byVariant, item, minimum, below)
    }
    /* A minimum on something the branch reports no row for is still a position:
       the branch should hold some and holds none. */
    for (const [skuId, minimum] of minimums ?? []) {
      if (items.some((item) => item.sku.id === skuId)) continue
      foldStockItem(byVariant, { sku: { id: skuId }, sellable: 0, nonSellable: 0, inTransit: 0 }, minimum, true)
    }
  }
  return byVariant
}

async function positionsFromOverview(search: string): Promise<Map<string, Position>> {
  const overview = await loadStockOverviewForInventory(search)
  const byVariant = new Map<string, Position>()
  for (const item of overview.items) {
    const minimum = item.locations.reduce<number | null>(
      (highest, row) => highestMinimum(highest, row.minQuantity),
      null,
    )
    foldStockItem(
      byVariant,
      {
        sku: item.sku,
        sellable: item.totals.sellable,
        nonSellable: item.totals.nonSellable,
        inTransit: item.totals.inTransit,
      },
      minimum,
      item.locations.some((row) => row.belowMinimum),
    )
  }
  return byVariant
}

function enrichPositions(
  positions: Map<string, Position>,
  branchIds: string[],
  reservedMap: Awaited<ReturnType<typeof draftReservedQuantities>>,
) {
  for (const [variantId, position] of positions) {
    applyHoldAndReserved(position.balances, reservedInScope(reservedMap, branchIds, variantId))
  }
}

/** One row per variant, its balances summed over the locations in scope. */
export async function listInventory(query: InventoryQuery): Promise<InventoryRow[]> {
  const db = readDb()
  const scope = visibleScope(query.scope)
  const branchIds = locationsIn(db, scope).map((branch) => branch.id)
  const [positions, reservedMap] = await Promise.all([
    canLoadInventoryFromOverview(scope)
      ? positionsFromOverview(query.search)
      : positionsByVariant(db, scope),
    draftReservedQuantities(scope, branchIds),
  ])
  enrichPositions(positions, branchIds, reservedMap)
  const term = query.search.trim().toLowerCase()
  const rows: InventoryRow[] = []

  /* Network-wide "out" / "low" include every catalog SKU. One branch selected:
     only variants that branch holds or has a minimum for. not the whole catalog. */
  const variantIds = needsWholeCatalog(query.filter)
    ? scope === ALL_BRANCHES
      ? [...new Set([...db.variants.map((variant) => variant.id), ...positions.keys()])]
      : [...positions.keys()]
    : [...positions.keys()]

  for (const variantId of variantIds) {
    const variant = db.variants.find((candidate) => candidate.id === variantId)
    const product = variant && db.products.find((candidate) => candidate.id === variant.productId)
    if (!variant || !product) continue

    const haystack =
      `${product.name} ${product.code} ${variant.sku} ${variant.barcode} ${variant.color} ${variant.size}`.toLowerCase()
    if (term && !haystack.includes(term)) continue

    let position = positions.get(variantId) ?? emptyPosition()
    const reservedOnly = reservedInScope(reservedMap, branchIds, variantId)
    if (!positions.has(variantId) && reservedOnly > 0) {
      position = emptyPosition()
      applyHoldAndReserved(position.balances, reservedOnly)
    }
    const { balances, minQuantity, belowMinimum, carried } = position
    const archived = product.archived || variant.archived
    const row: InventoryRow = {
      ...balances,
      minQuantity,
      belowMinimum,
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
      status: statusFor(balances, archived, belowMinimum),
    }
    if (matchesFilter(row, query.filter, carried || (row.reserved ?? 0) > 0)) rows.push(row)
  }

  rows.sort(
    (a, b) => a.productCode.localeCompare(b.productCode) || a.color.localeCompare(b.color) || a.sku.localeCompare(b.sku),
  )
  return rows
}

export async function getVariantDetail(variantId: string): Promise<VariantDetail> {
  const db = readDb()
  const branchIds = locationsIn(db, ALL_BRANCHES).map((branch) => branch.id)
  const reservedMap = await draftReservedQuantities(ALL_BRANCHES, branchIds)
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
        reserved: 0,
        onHold: 0,
        available: row.sellable,
        inTransit: row.inTransit,
      }
      applyHoldAndReserved(balances, reservedAtBranch(reservedMap, row.branchId, variantId))
      totals.onHand += balances.onHand
      totals.nonSellable += balances.nonSellable
      totals.reserved = (totals.reserved ?? 0) + (balances.reserved ?? 0)
      totals.onHold = (totals.onHold ?? 0) + (balances.onHold ?? 0)
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
        reserved: 0,
        onHold: 0,
        available: item?.sellable ?? 0,
        inTransit: item?.inTransit ?? 0,
      }
      applyHoldAndReserved(balances, reservedAtBranch(reservedMap, branch.id, variantId))
      totals.onHand += balances.onHand
      totals.nonSellable += balances.nonSellable
      totals.reserved = (totals.reserved ?? 0) + (balances.reserved ?? 0)
      totals.onHold = (totals.onHold ?? 0) + (balances.onHold ?? 0)
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
