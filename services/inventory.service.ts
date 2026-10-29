import { isPosted, stockSign } from '@/lib/invoices'
import { readDb, type MockDb } from '@/mocks/store'
import { branchNameOf, thresholdOf, visibleBranchIds, visibleScope } from '@/services/mock-ledger'
import { branchStockItems } from '@/services/stock-api.service'
import {
  ALL_BRANCHES,
  type Balances,
  type BranchScope,
  type InventoryFilter,
  type InventoryRow,
  type InventoryStatus,
  type LocationBalance,
  type Movement,
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
 * shown as "not available yet" rather than filled in from the local ledger.
 * The low-stock threshold is a manager's setting rather than a balance, so it
 * is still read from the local store (BL-05).
 */

function emptyBalances(): Balances {
  return { onHand: 0, nonSellable: 0, reserved: null, onHold: null, available: 0, inTransit: 0 }
}

function statusFor(balances: Balances, threshold: number, archived: boolean): InventoryStatus {
  if (archived) return 'archived'
  if (balances.available === 0 && balances.inTransit === 0) return 'out'
  if (balances.available <= threshold) return 'low'
  if (balances.inTransit > 0) return 'in_transit'
  if (balances.nonSellable > 0) return 'on_hold'
  return 'in_stock'
}

function matchesFilter(row: InventoryRow, filter: InventoryFilter) {
  if (filter === 'archived') return row.archived
  if (row.archived) return false
  if (filter === 'low') return row.status === 'low' || row.status === 'out'
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
  threshold: number
}

/** `GET /stock` for every location in scope, folded into one row per variant. */
async function carriedByVariant(db: MockDb, scope: BranchScope): Promise<Map<string, Carried>> {
  const byVariant = new Map<string, Carried>()

  for (const location of locationsIn(db, scope)) {
    for (const item of await branchStockItems(location.id)) {
      const level = db.stock.find(
        (candidate) => candidate.variantId === item.sku.id && candidate.branchId === location.id,
      )
      /* A row of nothing at a location that has never set a threshold means the
         variant is simply not carried there: not stock-out, just not sold. */
      const carries = item.sellable + item.nonSellable + item.inTransit > 0 || level !== undefined
      if (!carries) continue

      const current = byVariant.get(item.sku.id) ?? { balances: emptyBalances(), threshold: 0 }
      current.balances.onHand += item.sellable + item.nonSellable
      current.balances.nonSellable += item.nonSellable
      current.balances.available += item.sellable
      current.balances.inTransit += item.inTransit
      current.threshold = Math.max(current.threshold, thresholdOf(level))
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

  for (const [variantId, { balances, threshold }] of carried) {
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
      lowStockAt: threshold,
      status: statusFor(balances, threshold, archived),
    }
    if (matchesFilter(row, query.filter)) rows.push(row)
  }

  rows.sort(
    (a, b) => a.productCode.localeCompare(b.productCode) || a.color.localeCompare(b.color) || a.sku.localeCompare(b.sku),
  )
  return rows
}

function documentMovements(db: MockDb, variantId: string, visible: Set<string>): Movement[] {
  return db.invoices
    .filter((invoice) => isPosted(invoice) && !invoice.transferId && visible.has(invoice.branchId))
    .flatMap((invoice) =>
      db.invoiceLines
        .filter((line) => line.invoiceId === invoice.id && line.variantId === variantId)
        .map<Movement>((line) => ({
          id: line.id,
          at: invoice.issuedAt,
          kind: invoice.kind,
          branchName: branchNameOf(db, invoice.branchId),
          quantity: stockSign(invoice.kind) * line.quantity,
          reference: invoice.number,
          href: `/invoices/${invoice.id}`,
          note: invoice.reason,
        })),
    )
}

function eventMovements(db: MockDb, variantId: string, visible: Set<string>): Movement[] {
  return db.movements
    .filter((event) => event.variantId === variantId && visible.has(event.branchId))
    .map((event) => ({
      id: event.id,
      at: event.at,
      kind: event.kind,
      branchName: branchNameOf(db, event.branchId),
      quantity: event.quantity,
      reference: event.reference,
      href: event.refId?.startsWith('tr_') ? `/transfers/${event.refId}` : undefined,
      note: event.note,
    }))
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
    const level = db.stock.find(
      (candidate) => candidate.variantId === variantId && candidate.branchId === branch.id,
    )
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
      lowStockAt: thresholdOf(level),
    })
  }

  locations.sort((a, b) => Number(b.isWarehouse) - Number(a.isWarehouse) || a.branchName.localeCompare(b.branchName))

  const visible = new Set(locations.map((location) => location.branchId))
  const movements = [...documentMovements(db, variantId, visible), ...eventMovements(db, variantId, visible)].sort(
    (a, b) => b.at.localeCompare(a.at),
  )

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
    movements,
  }
}
