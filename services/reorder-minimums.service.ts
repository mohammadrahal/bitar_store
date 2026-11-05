import { ApiError } from '@/lib/api/api-error'
import { listReorderLevels } from '@/services/warehouse.service'

const PAGE = 200
const CACHE_MS = 30_000

/** Minimum per variant id, or `null` when the server would not say. */
export type Minimums = Map<string, number> | null

const cache = new Map<string, { data: Minimums; at: number }>()
const inflight = new Map<string, Promise<Minimums>>()

export function clearMinimumsCache(): void {
  cache.clear()
  inflight.clear()
}

async function fetchPages(branchId: string): Promise<Minimums> {
  const minimums = new Map<string, number>()
  for (let offset = 0; ; offset += PAGE) {
    const page = await listReorderLevels({ branchId, limit: PAGE, offset })
    for (const level of page) minimums.set(level.sku.id, level.minQuantity)
    if (page.length < PAGE) return minimums
  }
}

/**
 * What a branch should keep of each variant, from `GET /reorder-levels`.
 *
 * A `403` is an answer about who is asking, and `409` is the warehouse saying it
 * keeps no minimums at all — neither means "nothing is low". Both come back as
 * `null` so a caller can hide the figure instead of showing a zero that reads
 * as good news.
 */
export async function branchMinimums(branchId: string): Promise<Minimums> {
  const hit = cache.get(branchId)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data

  let pending = inflight.get(branchId)
  if (!pending) {
    pending = fetchPages(branchId)
      .catch((error: unknown) => {
        if (error instanceof ApiError && [403, 404, 409].includes(error.status)) return null
        throw error
      })
      .then((data) => {
        cache.set(branchId, { data, at: Date.now() })
        inflight.delete(branchId)
        return data
      })
      .catch((error: unknown) => {
        inflight.delete(branchId)
        throw error
      })
    inflight.set(branchId, pending)
  }
  return pending
}
