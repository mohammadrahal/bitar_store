import { getApiClient } from '@/lib/api'
import { lineInTransit } from '@/lib/transfers'
import { readDb, type MockDb } from '@/mocks/store'
import { getProduct } from '@/services/products.service'
import type { ProductWithVariants } from '@/types'

/** Why a model cannot be archived right now, or null when it can. */
function archiveBlocker(db: MockDb, productId: string): string | null {
  const ids = new Set(db.variants.filter((variant) => variant.productId === productId).map((variant) => variant.id))
  const levels = db.stock.filter((level) => ids.has(level.variantId))
  const onHand = levels.reduce((sum, level) => sum + level.quantity, 0)
  const reserved = levels.reduce((sum, level) => sum + level.reserved, 0)
  const transit = db.transfers.reduce(
    (sum, transfer) => sum + transfer.lines.filter((line) => ids.has(line.variantId)).reduce((s, l) => s + lineInTransit(l), 0),
    0,
  )
  const reasons = [
    onHand > 0 && `${onHand} on hand`,
    reserved > 0 && `${reserved} reserved`,
    transit > 0 && `${transit} in transit`,
  ].filter(Boolean)
  return reasons.length ? `It still has ${reasons.join(', ')}. Sell, move or write those off first.` : null
}

/** The API keeps every style for history, so archiving is the only way out of the catalog. */
export async function setProductArchived(productId: string, archived: boolean): Promise<ProductWithVariants> {
  const db = readDb()
  const product = db.products.find((candidate) => candidate.id === productId)
  if (!product) throw new Error('Product not found')
  if (archived) {
    const blocker = archiveBlocker(db, productId)
    if (blocker) throw new Error(`${product.name} cannot be archived. ${blocker}`)
  }
  await getApiClient().updateStyle(productId, { isActive: !archived })
  return getProduct(productId)
}
