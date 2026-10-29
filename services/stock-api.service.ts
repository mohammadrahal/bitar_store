import { getApiClient } from '@/lib/api'
import { mapApiSku, mapApiStyle } from '@/lib/api/map-catalog'
import { toBranchStockRow } from '@/lib/api/map-stock'
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
      local,
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

/** Sellable units per SKU at one branch (full branch list, not search-filtered). */
export async function branchSellableMap(branchId: string): Promise<Map<string, number>> {
  const items = await fetchStockPages({ branchId, activeOnly: true })
  return sellableMapsFromItems(items).bySkuId
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
