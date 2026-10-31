import { mapApiSku } from '@/lib/api/map-catalog'
import type { ApiSkuWithStyle, ApiStockItem } from '@/lib/api/types'
import { readDb } from '@/mocks/store'
import type { BranchStockRow, StockStatus } from '@/types'

function statusOf(available: number): StockStatus {
  return available === 0 ? 'out' : 'healthy'
}

/** Whole-number bucket counts from the API (handles numeric strings). */
export function stockQuantity(value: unknown): number {
  const amount = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0
}

function readSku(raw: Record<string, unknown>): ApiSkuWithStyle {
  return raw.sku as ApiSkuWithStyle
}

/** Normalise one stock row whether the API used camelCase or snake_case keys. */
export function normalizeStockItem(raw: unknown): ApiStockItem | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  if (!row.sku || typeof row.sku !== 'object') return null
  return {
    sku: readSku(row),
    sellable: stockQuantity(row.sellable ?? row.sellableQuantity),
    nonSellable: stockQuantity(row.nonSellable ?? row.non_sellable ?? row.nonSellableQuantity),
    inTransit: stockQuantity(row.inTransit ?? row.in_transit ?? row.inTransitQuantity),
  }
}

/**
 * `GET /stock/movements` rows, reduced to the SKU ids they name. The payload
 * is not in the API document yet, so every shape the server might use for the
 * id is accepted; `rows` is the page size, which is what paging reads.
 */
export function parseMovementSkuIds(payload: unknown): { rows: number; skuIds: string[] } {
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { items?: unknown }).items)
      ? (payload as { items: unknown[] }).items
      : []

  const skuIds: string[] = []
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue
    const row = entry as Record<string, unknown>
    const nested = row.sku && typeof row.sku === 'object' ? (row.sku as Record<string, unknown>) : undefined
    const id =
      typeof row.skuId === 'string'
        ? row.skuId
        : typeof row.sku_id === 'string'
          ? row.sku_id
          : typeof nested?.id === 'string'
            ? nested.id
            : null
    if (id) skuIds.push(id)
  }
  return { rows: list.length, skuIds }
}

/** `GET /stock` is an array; tolerate a wrapped payload if the server sends one. */
export function parseStockList(payload: unknown): ApiStockItem[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { items?: unknown }).items)
      ? (payload as { items: unknown[] }).items
      : []
  return rows.map(normalizeStockItem).filter((item): item is ApiStockItem => item !== null)
}

/** One branch stock row from the API's sellable / non-sellable / in-transit buckets. */
export function toBranchStockRow(item: ApiStockItem): BranchStockRow {
  const db = readDb()
  const variant = mapApiSku(item.sku, item.sku.style.code)
  const product = db.products.find((candidate) => candidate.id === variant.productId)
  const onHand = item.sellable + item.nonSellable
  const available = item.sellable

  return {
    variantId: variant.id,
    sku: variant.sku,
    barcode: variant.barcode,
    size: variant.size,
    color: variant.color,
    productId: variant.productId,
    productName: product?.name ?? item.sku.style.name,
    category: product?.category ?? '',
    quantity: onHand,
    available,
    status: statusOf(available),
    sellPrice: variant.sellPrice,
  }
}
