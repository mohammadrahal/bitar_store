import { getApiClient } from '@/lib/api'
import { mapApiSku, mapApiStyle } from '@/lib/api/map-catalog'
import { parseMovementSkuIds, toBranchStockRow } from '@/lib/api/map-stock'
import type { ApiStockItem, StockListParams } from '@/lib/api/types'
import { mirrorCatalog } from '@/mocks/mirror'
import { readDb } from '@/mocks/store'
import type { BranchStockRow, Product, Variant } from '@/types'

const PAGE = 200

/** Keep the local catalog aligned with SKUs returned from stock reads. */
function mirrorStockFromItems(items: ApiStockItem[]): void {
  if (items.length === 0) return

  const variantsById = new Map<string, Variant>()
  for (const item of items) {
    variantsById.set(item.sku.id, mapApiSku(item.sku, item.sku.style.code))
  }
  const variants = [...variantsById.values()]
  const styleIds = [...new Set(items.map((item) => item.sku.styleId))]
  const products = styleIds.map((styleId) => {
    const item = items.find((row) => row.sku.styleId === styleId)!
    const styleVariants = variants.filter((variant) => variant.productId === styleId)
    const local = readDb().products.find((product) => product.id === styleId)
    return mapApiStyle(
      {
        id: styleId,
        code: item.sku.style.code,
        name: item.sku.style.name,
        category: null,
        isActive: item.sku.isActive,
        createdAt: item.sku.createdAt,
        updatedAt: item.sku.updatedAt,
      },
      styleVariants,
    )
  })

  mirrorCatalog(products, variants)
}

async function fetchStockPages(params: Omit<StockListParams, 'limit' | 'offset'>): Promise<ApiStockItem[]> {
  const api = getApiClient()
  const items: ApiStockItem[] = []
  for (let offset = 0; ; offset += PAGE) {
    const page = await api.listStock({ ...params, limit: PAGE, offset })
    mirrorStockFromItems(page)
    items.push(...page)
    if (page.length < PAGE) return items
  }
}

async function fetchAllStock(params: Omit<StockListParams, 'limit' | 'offset'>): Promise<BranchStockRow[]> {
  const items = await fetchStockPages(params)
  const live = items.filter((item) => item.sellable + item.nonSellable + item.inTransit > 0)
  return live.map(toBranchStockRow)
}

/**
 * Every row the API holds for a branch, zero rows included. The stat cards
 * and low-stock list need the empties, which `listBranchStockFromApi` drops.
 */
export async function branchStockItems(branchId: string): Promise<ApiStockItem[]> {
  return fetchStockPages({ branchId, activeOnly: true })
}

/** Everything the API knows is at this branch, bar rows with nothing on them. */
export async function listBranchStockFromApi(branchId: string, search = ''): Promise<BranchStockRow[]> {
  const rows = await fetchAllStock({ branchId, search: search.trim() || undefined, activeOnly: true })
  return rows.sort(
    (a, b) => a.available - b.available || a.productName.localeCompare(b.productName) || a.sku.localeCompare(b.sku),
  )
}

/* A long history is not worth sweeping for this answer: the server refuses a
   SKU that has moved anyway, so a partial set only costs a clearer message. */
const MOVEMENT_PAGES = 20

/**
 * SKU ids with any movement at a branch, from `GET /stock/movements`. Opening
 * stock is accepted only for a SKU that has never moved there, so this is what
 * says which ones can still be opened.
 */
export async function movedSkusAt(branchId: string): Promise<Set<string>> {
  const api = getApiClient()
  const moved = new Set<string>()
  for (let page = 0; page < MOVEMENT_PAGES; page += 1) {
    const { rows, skuIds } = parseMovementSkuIds(
      await api.listStockMovements({ branchId, limit: PAGE, offset: page * PAGE }),
    )
    for (const id of skuIds) moved.add(id)
    if (rows < PAGE) break
  }
  return moved
}

/** Rows for one style at one branch, zero rows included. */
export async function styleStockItems(branchId: string, styleId: string): Promise<ApiStockItem[]> {
  return fetchStockPages({ branchId, styleId })
}

/** Sellable units per SKU at one branch (full branch list, not search-filtered). */
export async function branchSellableMap(branchId: string): Promise<Map<string, number>> {
  const items = await fetchStockPages({ branchId, activeOnly: true })
  const { bySkuId, bySkuCode } = sellableMapsFromItems(items)
  return new Map([...bySkuId, ...bySkuCode])
}

/** Sellable at one branch for a single style — matches `GET /stock?styleId=`. */
export async function branchSellableMapForStyle(branchId: string, styleId: string): Promise<{
  bySkuId: Map<string, number>
  bySkuCode: Map<string, number>
}> {
  const items = await fetchStockPages({ branchId, styleId })
  return sellableMapsFromItems(items)
}

function sellableMapsFromItems(items: ApiStockItem[]) {
  const bySkuId = new Map<string, number>()
  const bySkuCode = new Map<string, number>()
  for (const item of items) {
    const qty = item.sellable
    bySkuId.set(item.sku.id, qty)
    bySkuCode.set(item.sku.skuCode, qty)
  }
  return { bySkuId, bySkuCode }
}

export async function branchStockUnitsFromApi(branchId: string): Promise<number> {
  const rows = await listBranchStockFromApi(branchId)
  return rows.reduce((sum, row) => sum + row.quantity, 0)
}
