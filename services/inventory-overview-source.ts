import type { ApiStockOverview } from '@/lib/api/types'
import { mapApiSku, mapApiStyle } from '@/lib/api/map-catalog'
import { canViewAdminWarehouseTools } from '@/lib/api-access'
import { mirrorCatalog } from '@/mocks/mirror'
import { useUserStore } from '@/store/user-store'
import { fetchAllStockOverviewCached } from '@/services/warehouse.service'
import { ALL_BRANCHES, type BranchScope } from '@/types'

export function canLoadInventoryFromOverview(scope: BranchScope): boolean {
  if (scope !== ALL_BRANCHES) return false
  const user = useUserStore.getState().user
  return user ? canViewAdminWarehouseTools(user) : false
}

function mirrorOverviewSkus(overview: ApiStockOverview): void {
  const variants = overview.items.map((item) => mapApiSku(item.sku, item.sku.style.code))
  const styleIds = [...new Set(overview.items.map((item) => item.sku.styleId))]
  const products = styleIds.map((styleId) => {
    const item = overview.items.find((row) => row.sku.styleId === styleId)!
    const styleVariants = variants.filter((variant) => variant.productId === styleId)
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

/** Admin network inventory: paginated `GET /stock/overview` instead of one `GET /stock` per branch. */
export async function loadStockOverviewForInventory(search: string): Promise<ApiStockOverview> {
  const overview = await fetchAllStockOverviewCached({
    search: search.trim() || undefined,
    activeOnly: true,
  })
  mirrorOverviewSkus(overview)
  return overview
}
