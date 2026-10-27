import { delay, delayedFailure } from '@/lib/delay'
import { isPosted, stockSign } from '@/lib/invoices'
import { readDb, type MockDb } from '@/mocks/store'
import {
  addBalances,
  balancesOf,
  branchNameOf,
  inTransitMap,
  levelOf,
  thresholdOf,
  visibleBranchIds,
  visibleScope,
  zeroBalances,
} from '@/services/mock-ledger'
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

function statusFor(balances: Balances, threshold: number, archived: boolean): InventoryStatus {
  if (archived) return 'archived'
  if (balances.available === 0 && balances.inTransit === 0) return 'out'
  if (balances.available <= threshold) return 'low'
  if (balances.inTransit > 0) return 'in_transit'
  if (balances.onHold > 0) return 'on_hold'
  return 'in_stock'
}

function matchesFilter(row: InventoryRow, filter: InventoryFilter) {
  if (filter === 'archived') return row.archived
  if (row.archived) return false
  if (filter === 'low') return row.status === 'low' || row.status === 'out'
  if (filter === 'on_hold') return row.onHold > 0
  if (filter === 'in_transit') return row.inTransit > 0
  return true
}

function locationsIn(db: MockDb, scope: BranchScope) {
  const visible = new Set(visibleBranchIds(db))
  return db.branches.filter((branch) => visible.has(branch.id) && (scope === ALL_BRANCHES || branch.id === scope))
}

/** One row per variant, its balances summed over the locations in scope. In transit is counted once, at the receiver. */
export async function listInventory(query: InventoryQuery): Promise<InventoryRow[]> {
  const db = readDb()
  const scope = visibleScope(query.scope)
  const locations = locationsIn(db, scope)
  const transit = inTransitMap(db)
  const term = query.search.trim().toLowerCase()
  const rows: InventoryRow[] = []

  for (const variant of db.variants) {
    const product = db.products.find((candidate) => candidate.id === variant.productId)
    if (!product) continue
    const haystack = `${product.name} ${product.code} ${variant.sku} ${variant.barcode} ${variant.color} ${variant.size}`.toLowerCase()
    if (term && !haystack.includes(term)) continue

    // A variant no location in scope carries, or is sending it, is not out of stock there: it is not sold there.
    const carried = locations.some(
      (location) => levelOf(db, variant.id, location.id) || transit.has(`${variant.id}|${location.id}`),
    )
    if (!carried) continue

    const totals = zeroBalances()
    let threshold = 0
    for (const location of locations) {
      const level = levelOf(db, variant.id, location.id)
      addBalances(totals, balancesOf(level, transit.get(`${variant.id}|${location.id}`) ?? 0))
      threshold = Math.max(threshold, thresholdOf(level))
    }

    const row: InventoryRow = {
      ...totals,
      variantId: variant.id,
      productId: product.id,
      productName: product.name,
      productCode: product.code,
      variantCode: variant.code,
      sku: variant.sku,
      barcode: variant.barcode,
      size: variant.size,
      color: variant.color,
      category: product.category,
      archived: product.archived || variant.archived,
      lowStockAt: threshold,
      status: statusFor(totals, threshold, product.archived || variant.archived),
    }
    if (matchesFilter(row, query.filter)) rows.push(row)
  }

  rows.sort((a, b) => a.productCode.localeCompare(b.productCode) || a.color.localeCompare(b.color) || a.sku.localeCompare(b.sku))
  return delay(rows)
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
  if (!variant || !product) return delayedFailure('This variant no longer exists.')

  const transit = inTransitMap(db)
  const totals = zeroBalances()
  const locations: LocationBalance[] = locationsIn(db, ALL_BRANCHES)
    .map((branch) => {
      const level = levelOf(db, variantId, branch.id)
      const balances = balancesOf(level, transit.get(`${variantId}|${branch.id}`) ?? 0)
      addBalances(totals, balances)
      return {
        ...balances,
        branchId: branch.id,
        branchName: branch.name,
        isWarehouse: branch.id === db.warehouseId,
        lowStockAt: thresholdOf(level),
      }
    })
    .sort((a, b) => Number(b.isWarehouse) - Number(a.isWarehouse) || a.branchName.localeCompare(b.branchName))

  const visible = new Set(locations.map((location) => location.branchId))
  const movements = [...documentMovements(db, variantId, visible), ...eventMovements(db, variantId, visible)].sort((a, b) =>
    b.at.localeCompare(a.at),
  )

  return delay({
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
  })
}
