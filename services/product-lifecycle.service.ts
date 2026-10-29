import { getApiClient } from '@/lib/api'
import { lineInTransit } from '@/lib/transfers'
import { readDb } from '@/mocks/store'
import { getProduct } from '@/services/products.service'
import { branchStockItems } from '@/services/stock-api.service'
import type { ProductWithVariants } from '@/types'

interface Holdings {
  onHand: number
  nonSellable: number
  reserved: number
  inTransit: number
}

/**
 * What the given SKUs still hold, at every location. On hand, non-sellable and
 * in transit come from `GET /stock`, which is the server's own picture;
 * reservations and transfer legs are still local, so they are added on top.
 */
async function holdingsOf(variantIds: Set<string>): Promise<Holdings> {
  const db = readDb()
  const totals: Holdings = { onHand: 0, nonSellable: 0, reserved: 0, inTransit: 0 }

  for (const branch of db.branches) {
    const items = await branchStockItems(branch.id)
    for (const item of items) {
      if (!variantIds.has(item.sku.id)) continue
      totals.onHand += item.sellable
      totals.nonSellable += item.nonSellable
      totals.inTransit += item.inTransit
    }
  }

  for (const level of db.stock) {
    if (variantIds.has(level.variantId)) totals.reserved += level.reserved
  }
  for (const transfer of db.transfers) {
    for (const line of transfer.lines) {
      if (variantIds.has(line.variantId)) totals.inTransit += lineInTransit(line)
    }
  }
  return totals
}

/** Why these SKUs cannot be archived right now, or null when they can. */
async function archiveBlocker(variantIds: Set<string>): Promise<string | null> {
  if (variantIds.size === 0) return null
  const totals = await holdingsOf(variantIds)
  const reasons = [
    totals.onHand > 0 && `${totals.onHand} on hand`,
    totals.nonSellable > 0 && `${totals.nonSellable} non-sellable`,
    totals.reserved > 0 && `${totals.reserved} reserved`,
    totals.inTransit > 0 && `${totals.inTransit} in transit`,
  ].filter(Boolean)
  if (reasons.length === 0) return null
  return `It still has ${reasons.join(', ')} somewhere. Sell, move or write those units off first (BL-01 P11).`
}

/** The API keeps every style for history, so archiving is the only way out of the catalog. */
export async function setProductArchived(productId: string, archived: boolean): Promise<ProductWithVariants> {
  const db = readDb()
  const product = db.products.find((candidate) => candidate.id === productId)
  if (!product) throw new Error('Product not found')

  if (archived) {
    const ids = new Set(db.variants.filter((variant) => variant.productId === productId).map((variant) => variant.id))
    const blocker = await archiveBlocker(ids)
    if (blocker) throw new Error(`${product.name} cannot be archived. ${blocker}`)
  }
  await getApiClient().updateStyle(productId, { isActive: !archived })
  return getProduct(productId)
}

/**
 * One variant out of the pickers. Blocked the same way as a whole model: a
 * variant with units anywhere would leave stock nobody can sell or move.
 */
export async function setVariantArchived(variantId: string, archived: boolean): Promise<void> {
  if (archived) {
    const variant = readDb().variants.find((candidate) => candidate.id === variantId)
    const blocker = await archiveBlocker(new Set([variantId]))
    if (blocker) throw new Error(`${variant?.sku ?? 'That variant'} cannot be archived. ${blocker}`)
  }
  await getApiClient().updateSku(variantId, { isActive: !archived })
}
