import { getApiClient } from '@/lib/api'
import { commitDb, readDb } from '@/mocks/store'
import { actorName } from '@/services/mock-ledger'
import type { OpeningStockPost } from '@/types'

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

/** Every location whose opening count has already been posted. */
export async function listOpeningPosts(): Promise<OpeningStockPost[]> {
  return readDb().openingPosts
}

export async function openingPostFor(branchId: string): Promise<OpeningStockPost | null> {
  return readDb().openingPosts.find((post) => post.branchId === branchId) ?? null
}

/**
 * Posts a counted opening quantity for one location, once.
 *
 * The API refuses a SKU that already has movement at that branch, so a second
 * attempt would partly succeed and partly fail. Recording the post here closes
 * the screen instead: a location is opened one time, and anything after that is
 * a count or a receipt. The record is local until the backend keeps it.
 */
export async function postOpeningStock(input: OpeningStock): Promise<OpeningStockPost> {
  const db = readDb()
  if (db.openingPosts.some((post) => post.branchId === input.branchId)) {
    throw new Error('Opening stock has already been posted for this location. Use a physical count instead.')
  }

  const lines = Object.values(input.quantities).filter((quantity) => quantity > 0).length
  if (lines === 0) throw new Error('Enter at least one counted quantity.')

  await placeOpeningStock([input])

  const post: OpeningStockPost = {
    branchId: input.branchId,
    postedAt: new Date().toISOString(),
    postedBy: actorName(),
    lines,
  }
  const next = readDb()
  next.openingPosts.push(post)
  commitDb(next)
  return post
}
