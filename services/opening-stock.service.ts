import { readDb, commitDb } from '@/mocks/store'
import { postAdjustments } from '@/services/adjustment-docs'
import { ensureLevel, visibleBranchIds } from '@/services/mock-ledger'

export interface OpeningStock {
  branchId: string
  /** Units per variant id. Zero still places the variant at the branch. */
  quantities: Record<string, number>
}

export const OPENING_STOCK_REASON = 'Opening stock'

/**
 * Places new variants at the chosen branches. Each gets a stock row there, so
 * the branch carries it, and any opening units are posted as an adjustment
 * document so they show in the stock history like every other movement.
 */
export function placeOpeningStock(plan: OpeningStock[]): void {
  const db = readDb()
  const allowed = new Set(visibleBranchIds(db))
  for (const { branchId, quantities } of plan) {
    if (!allowed.has(branchId) || !db.branches.some((branch) => branch.id === branchId)) continue
    const entries = Object.entries(quantities).filter(([variantId]) => db.variants.some((variant) => variant.id === variantId))
    for (const [variantId] of entries) ensureLevel(db, variantId, branchId)
    const items = entries
      .filter(([, quantity]) => quantity > 0)
      .map(([variantId, quantity]) => ({ variantId, delta: Math.floor(quantity) }))
    if (items.length) postAdjustments(db, branchId, OPENING_STOCK_REASON, items)
  }
  commitDb(db)
}

/** Branches that already carry any variant of the model, where its new variants belong too. */
export function branchesCarrying(productId: string): string[] {
  const db = readDb()
  const ids = new Set(db.variants.filter((variant) => variant.productId === productId).map((variant) => variant.id))
  return [...new Set(db.stock.filter((level) => ids.has(level.variantId)).map((level) => level.branchId))]
}
