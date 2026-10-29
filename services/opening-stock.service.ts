import { getApiClient } from '@/lib/api'
import { readDb } from '@/mocks/store'
import { listBranchStockFromApi } from '@/services/stock-api.service'

export interface OpeningStock {
  branchId: string
  /** Units per variant id. Only quantities above zero are sent to the API. */
  quantities: Record<string, number>
}

/** Opening stock on the server. Each branch batch gets its own idempotency key. */
export async function placeOpeningStock(plan: OpeningStock[]): Promise<void> {
  const api = getApiClient()
  const known = new Set(readDb().variants.map((variant) => variant.id))
  for (const { branchId, quantities } of plan) {
    const lines = Object.entries(quantities)
      .filter(([skuId, quantity]) => known.has(skuId) && quantity > 0)
      .map(([skuId, quantity]) => ({ skuId, quantity: Math.floor(quantity) }))
    if (lines.length === 0) continue
    await api.setOpeningStock({ branchId, lines }, crypto.randomUUID())
  }
}

/** Branches that already hold any unit of this style, so new SKUs belong there too. */
export async function branchesCarryingProduct(styleId: string): Promise<string[]> {
  const branches: string[] = []
  for (const branch of readDb().branches) {
    const rows = await listBranchStockFromApi(branch.id)
    if (rows.some((row) => row.productId === styleId && row.quantity > 0)) branches.push(branch.id)
  }
  return branches
}
