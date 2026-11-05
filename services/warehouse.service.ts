import { getApiClient } from '@/lib/api'
import type {
  ApiReplenishmentSuggestions,
  ApiReorderLevel,
  ApiStockOverview,
  ReorderLevelInput,
  ReorderLevelListParams,
  StockOverviewParams,
} from '@/lib/api/types'

export async function fetchStockOverview(params: StockOverviewParams = {}): Promise<ApiStockOverview> {
  return getApiClient().getStockOverview(params)
}

const OVERVIEW_PAGE = 200
const OVERVIEW_CACHE_MS = 30_000

type OverviewParams = Omit<StockOverviewParams, 'limit' | 'offset'>

function overviewCacheKey(params: OverviewParams): string {
  return JSON.stringify({
    search: params.search?.trim() || '',
    styleId: params.styleId ?? '',
    activeOnly: params.activeOnly ?? true,
  })
}

const overviewCache = new Map<string, { data: ApiStockOverview; at: number }>()
const overviewInflight = new Map<string, Promise<ApiStockOverview>>()

/** Drop cached admin overview pages after stock or catalog mutations. */
export function clearStockOverviewCache(): void {
  overviewCache.clear()
  overviewInflight.clear()
}

async function fetchAllStockOverviewPages(params: OverviewParams = {}): Promise<ApiStockOverview> {
  const items: ApiStockOverview['items'] = []
  let locations: ApiStockOverview['locations'] = []
  for (let offset = 0; ; offset += OVERVIEW_PAGE) {
    const page = await fetchStockOverview({ ...params, limit: OVERVIEW_PAGE, offset, activeOnly: params.activeOnly ?? true })
    if (offset === 0) locations = page.locations
    items.push(...page.items)
    if (page.items.length < OVERVIEW_PAGE) return { locations, items }
  }
}

/**
 * Every SKU page from `GET /stock/overview` (admin). Search is applied on the server.
 * Prefer {@link fetchAllStockOverviewCached} when several screens read the same snapshot.
 */
export async function fetchAllStockOverview(params: OverviewParams = {}): Promise<ApiStockOverview> {
  return fetchAllStockOverviewPages(params)
}

/** Shares one in-flight fetch and a short-lived cache (products list + inventory). */
export async function fetchAllStockOverviewCached(params: OverviewParams = {}): Promise<ApiStockOverview> {
  const key = overviewCacheKey(params)
  const hit = overviewCache.get(key)
  if (hit && Date.now() - hit.at < OVERVIEW_CACHE_MS) return hit.data

  let pending = overviewInflight.get(key)
  if (!pending) {
    pending = fetchAllStockOverviewPages(params)
      .then((data) => {
        overviewCache.set(key, { data, at: Date.now() })
        return data
      })
      /* Released whether the fetch resolved or threw. A rejected promise left
         in the map is handed to every later caller, so a retry would answer
         with the first failure instead of reaching the server again. */
      .finally(() => {
        overviewInflight.delete(key)
      })
    overviewInflight.set(key, pending)
  }
  return pending
}

export async function listReorderLevels(params: ReorderLevelListParams): Promise<ApiReorderLevel[]> {
  return getApiClient().listReorderLevels(params)
}

export async function setReorderLevel(input: ReorderLevelInput) {
  return getApiClient().setReorderLevel(input)
}

export async function deleteReorderLevel(id: string): Promise<void> {
  return getApiClient().deleteReorderLevel(id)
}

export async function fetchReplenishmentSuggestions(branchId?: string): Promise<ApiReplenishmentSuggestions> {
  return getApiClient().getReplenishmentSuggestions({ branchId })
}
