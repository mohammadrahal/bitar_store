import { canViewAdminWarehouseTools } from '@/lib/api-access'
import type { ApiStockOverview } from '@/lib/api/types'
import { readDb, type MockDb } from '@/mocks/store'
import { visibleBranchIds, visibleScope } from '@/services/mock-ledger'
import { branchMinimums, type Minimums } from '@/services/reorder-minimums.service'
import { branchStockItems } from '@/services/stock-api.service'
import { fetchAllStockOverviewCached } from '@/services/warehouse.service'
import { useUserStore } from '@/store/user-store'
import { ALL_BRANCHES, type Branch, type BranchScope } from '@/types'

/**
 * What is empty or running out, counted in **variants** rather than in
 * variant-and-location pairs.
 *
 * `GET /dashboard/overview` answers `outOfStock` as a pair count: 225 active
 * SKUs across 29 locations came back as 6,524, which is larger than the catalog
 * and so cannot be read as "how many things are we out of". The question a
 * shopkeeper asks is "how many variants can I not sell", so the counts here are
 * computed from the per-location balances instead, and `outOfStock` can never
 * exceed {@link StockHealth.variantCount}.
 */
export interface StockHealth {
  /** Variants with nothing sellable anywhere in scope. */
  outOfStock: number
  /**
   * Variants that are sellable somewhere in scope but empty at one or more of
   * the locations that carry them. Zero when the scope is a single location,
   * where "elsewhere" has no meaning.
   */
  outElsewhere: number
  /** Variants under their minimum at one or more locations in scope. */
  lowStock: number
  /** Of those, the ones still sellable somewhere else in scope. */
  lowElsewhere: number
  /**
   * False when no minimum could be read for the scope, which is not the same as
   * "nothing is low". The low-stock tile hides itself rather than show a zero it
   * cannot stand behind.
   */
  minimumsKnown: boolean
  /** Variants the counts were taken over, so a reader can size them. */
  variantCount: number
  scopedToOneLocation: boolean
  /** Variants with sellable units in scope, keyed by variant id. Feeds the slow sellers list. */
  sellable: Record<string, StockedVariant>
}

export interface StockedVariant {
  variantId: string
  productName: string
  color: string
  size: string
  sku: string
  sellable: number
}

/** A location holds a variant once it has units there, or a minimum set for it. */
function carries(row: { sellable: number; nonSellable: number; inTransit: number; minQuantity?: number | null }) {
  return row.sellable + row.nonSellable + row.inTransit > 0 || row.minQuantity != null
}

function canUseOverview(): boolean {
  const user = useUserStore.getState().user
  return user ? canViewAdminWarehouseTools(user) : false
}

function branchesInScope(db: MockDb, scope: BranchScope): Branch[] {
  const visible = new Set(visibleBranchIds(db))
  return db.branches.filter(
    (branch) => visible.has(branch.id) && (scope === ALL_BRANCHES || branch.id === scope),
  )
}

function emptyHealth(scopedToOneLocation: boolean): StockHealth {
  return {
    outOfStock: 0,
    outElsewhere: 0,
    lowStock: 0,
    lowElsewhere: 0,
    minimumsKnown: false,
    variantCount: 0,
    scopedToOneLocation,
    sellable: {},
  }
}

/**
 * The admin read: one paged sweep of `GET /stock/overview` carries every
 * location's balances and its minimum, so both counts come from one snapshot.
 */
function healthFromOverview(overview: ApiStockOverview, scope: BranchScope): StockHealth {
  const single = scope !== ALL_BRANCHES
  const inScope = (branchId: string) => !single || branchId === scope
  const health = emptyHealth(single)
  /* The server computes `belowMinimum` itself (sellable + inTransit under the
     branch minimum), so a minimum anywhere in scope means the figure is real. */
  health.minimumsKnown = true

  for (const item of overview.items) {
    const rows = item.locations.filter((row) => inScope(row.branchId))
    if (rows.length === 0) continue

    /* Overview lists every active branch for every SKU, usually with zeros.
       A branch that has never held a SKU is not "out" of it. skip those rows
       when the header scopes to one location. */
    const carrying = rows.filter((row) =>
      carries({
        sellable: row.sellable,
        nonSellable: row.nonSellable,
        inTransit: row.inTransit,
        minQuantity: row.minQuantity,
      }),
    )
    if (single && carrying.length === 0) continue

    health.variantCount += 1

    const sellable = (single ? carrying : rows).reduce((sum, row) => sum + row.sellable, 0)
    if (sellable > 0 && item.sku.isActive) {
      health.sellable[item.sku.id] = {
        variantId: item.sku.id,
        productName: item.sku.style.name,
        color: item.sku.color,
        size: item.sku.size,
        sku: item.sku.skuCode,
        sellable,
      }
    }
    if (sellable === 0) {
      health.outOfStock += 1
    } else if (!single && rows.some((row) => row.sellable === 0 && carries(row))) {
      health.outElsewhere += 1
    }

    const lowRows = single ? carrying : rows
    if (lowRows.some((row) => row.belowMinimum)) {
      health.lowStock += 1
      if (!single && rows.some((row) => !row.belowMinimum && row.sellable > 0)) health.lowElsewhere += 1
    }
  }

  return health
}

interface BranchPosition {
  branchId: string
  /** Sellable per variant id; absent means the branch reported no row. */
  sellable: Map<string, number>
  held: Map<string, number>
  /** Minimum per variant id, or null when minimums could not be read. */
  minimums: Minimums
}

async function positionsFor(branches: Branch[]): Promise<BranchPosition[]> {
  return Promise.all(
    branches.map(async (branch) => {
      const [items, minimums] = await Promise.all([branchStockItems(branch.id), branchMinimums(branch.id)])
      const sellable = new Map<string, number>()
      const held = new Map<string, number>()
      for (const item of items) {
        sellable.set(item.sku.id, (sellable.get(item.sku.id) ?? 0) + item.sellable)
        held.set(item.sku.id, (held.get(item.sku.id) ?? 0) + item.nonSellable + item.inTransit)
      }
      return { branchId: branch.id, sellable, held, minimums }
    }),
  )
}

/**
 * The manager and employee read: `GET /stock` per location in scope, with
 * `GET /reorder-levels` for the thresholds. The catalog mirror supplies the
 * variant list, because a branch that has never held a variant reports no row
 * for it at all and "out of stock" has to include those.
 */
function healthFromBranches(db: MockDb, positions: BranchPosition[], single: boolean): StockHealth {
  const health = emptyHealth(single)
  health.minimumsKnown = positions.some((position) => position.minimums !== null)

  const variants = db.variants.filter((variant) => {
    const product = db.products.find((candidate) => candidate.id === variant.productId)
    return !variant.archived && product && !product.archived
  })

  for (const variant of variants) {
    let sellable = 0
    let carriedInScope = false
    let outAtCarrier = false
    let low = false
    let healthySomewhere = false

    for (const position of positions) {
      const here = position.sellable.get(variant.id) ?? 0
      const minimum = position.minimums?.get(variant.id) ?? null
      const carried = carries({
        sellable: here,
        nonSellable: position.held.get(variant.id) ?? 0,
        inTransit: 0,
        minQuantity: minimum,
      })
      if (carried) carriedInScope = true
      sellable += here
      if (here === 0 && carried) outAtCarrier = true
      if (minimum !== null && here < minimum) low = true
      else if (here > 0) healthySomewhere = true
    }

    /* One location selected: only SKUs this branch holds or has a minimum for. */
    if (single && !carriedInScope) continue

    health.variantCount += 1

    if (sellable > 0) {
      health.sellable[variant.id] = {
        variantId: variant.id,
        productName: db.products.find((product) => product.id === variant.productId)?.name ?? '',
        color: variant.color,
        size: variant.size,
        sku: variant.sku,
        sellable,
      }
    }
    if (sellable === 0) health.outOfStock += 1
    else if (!single && outAtCarrier) health.outElsewhere += 1

    if (low) {
      health.lowStock += 1
      if (!single && healthySomewhere) health.lowElsewhere += 1
    }
  }

  return health
}

/** The two stock counts on the overview, and the "more at some locations" lines. */
export async function getStockHealth(scope: BranchScope): Promise<StockHealth> {
  const db = readDb()
  const resolved = visibleScope(scope)
  const branches = branchesInScope(db, resolved)
  if (branches.length === 0) return emptyHealth(resolved !== ALL_BRANCHES)

  if (canUseOverview()) {
    const overview = await fetchAllStockOverviewCached({ activeOnly: true })
    return healthFromOverview(overview, resolved)
  }

  const positions = await positionsFor(branches)
  return healthFromBranches(db, positions, resolved !== ALL_BRANCHES)
}
