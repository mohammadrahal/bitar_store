import { getApiClient } from '@/lib/api'
import { readDb } from '@/mocks/store'
import { movedSkusAt } from '@/services/stock-api.service'

export interface OpeningStock {
  branchId: string
  /** Units per SKU id. Only quantities above zero are sent to the API. */
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

export interface OpeningStockState {
  /** SKUs the server has already moved here, which it will not open again. */
  movedSkuIds: string[]
}

/**
 * What can still be opened at a location. `POST /stock/opening` accepts a SKU
 * that has never moved at that branch and refuses one that has, so the sheet
 * offers exactly the first set — which is how a model added later gets its
 * first units at a location that opened months ago.
 */
export async function openingStateFor(branchId: string): Promise<OpeningStockState> {
  return { movedSkuIds: [...(await movedSkusAt(branchId))] }
}

export async function postOpeningStock(input: OpeningStock): Promise<{ lines: number }> {
  const entries = Object.entries(input.quantities).filter(([, quantity]) => quantity > 0)
  if (entries.length === 0) throw new Error('Enter at least one counted quantity.')

  const moved = await movedSkusAt(input.branchId)
  const refused = entries.filter(([skuId]) => moved.has(skuId)).length
  if (refused > 0) {
    throw new Error(
      `${refused} ${refused === 1 ? 'SKU has' : 'SKUs have'} already moved at this location, so they cannot be opened again.`,
    )
  }

  await placeOpeningStock([input])
  return { lines: entries.length }
}
