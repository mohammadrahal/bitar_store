import { delay } from '@/lib/delay'
import { lineStillReserved } from '@/lib/transfers'
import { readDb, type MockDb } from '@/mocks/store'
import { availableOf, branchNameOf, inTransitMap, levelOf, visibleBranchIds } from '@/services/mock-ledger'
import { ALL_BRANCHES, type BranchScope, type ReplenishmentRow } from '@/types'

/** Units already requested or approved towards a branch but not dispatched yet. */
function onOrderMap(db: MockDb) {
  const map = new Map<string, number>()
  for (const transfer of db.transfers) {
    if (transfer.status !== 'requested' && transfer.status !== 'approved') continue
    for (const line of transfer.lines) {
      const pending = transfer.status === 'requested' ? line.requested : lineStillReserved(line)
      const key = `${line.variantId}|${transfer.toBranchId}`
      map.set(key, (map.get(key) ?? 0) + pending)
    }
  }
  return map
}

/**
 * Branch variants at or below their threshold once incoming units are
 * counted, with a suggestion that brings them back to twice the threshold.
 * The warehouse is the source, so it never appears as a row itself.
 */
export async function listReplenishment(scope: BranchScope): Promise<ReplenishmentRow[]> {
  const db = readDb()
  if (!db.warehouseId) return delay([])
  const visible = new Set(visibleBranchIds(db))
  const transit = inTransitMap(db)
  const onOrder = onOrderMap(db)
  const rows: ReplenishmentRow[] = []

  for (const level of db.stock) {
    if (level.branchId === db.warehouseId || !visible.has(level.branchId)) continue
    if (scope !== ALL_BRANCHES && level.branchId !== scope) continue
    const variant = db.variants.find((candidate) => candidate.id === level.variantId)
    const product = variant && db.products.find((candidate) => candidate.id === variant.productId)
    if (!variant || !product || product.archived || variant.archived) continue

    const key = `${variant.id}|${level.branchId}`
    const incoming = (transit.get(key) ?? 0) + (onOrder.get(key) ?? 0)
    const available = availableOf(level)
    if (available + incoming > level.lowStockAt) continue

    const warehouseAvailable = availableOf(levelOf(db, variant.id, db.warehouseId))
    rows.push({
      variantId: variant.id,
      productName: product.name,
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      branchId: level.branchId,
      branchName: branchNameOf(db, level.branchId),
      available,
      inTransit: incoming,
      lowStockAt: level.lowStockAt,
      suggested: Math.max(0, level.lowStockAt * 2 - available - incoming),
      warehouseAvailable,
    })
  }

  rows.sort((a, b) => a.branchName.localeCompare(b.branchName) || a.available - b.available || a.sku.localeCompare(b.sku))
  return delay(rows)
}
