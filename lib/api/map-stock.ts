import { mapApiSku } from '@/lib/api/map-catalog'
import type { ApiSkuWithStyle, ApiStockItem } from '@/lib/api/types'
import { DEFAULT_LOW_STOCK_AT } from '@/mocks/store'
import { readDb } from '@/mocks/store'
import type { BranchStockRow, StockStatus } from '@/types'

function statusOf(available: number, lowStockAt: number): StockStatus {
  if (available === 0) return 'out'
  return available <= lowStockAt ? 'low' : 'healthy'
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
  const local = db.stock.find((level) => level.variantId === variant.id && level.branchId)
  const onHand = item.sellable + item.nonSellable
  const available = item.sellable
  const lowStockAt = local?.lowStockAt ?? DEFAULT_LOW_STOCK_AT

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
    lowStockAt,
    status: statusOf(available, lowStockAt),
    costPrice: product?.costPrice ?? 0,
    sellPrice: variant.sellPrice,
  }
}
