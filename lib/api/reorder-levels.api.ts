import type { RequestFn } from '@/lib/api/client'
import { queryOf } from '@/lib/api/query'
import type {
  ApiReorderLevel,
  ReorderLevelByStyleInput,
  ReorderLevelInput,
  ReorderLevelListParams,
} from '@/lib/api/types'

/**
 * The per-branch minimum and target per SKU, and the server's own
 * replenishment suggestions. Every call needs `adjustments.create`.
 */
export function createReorderLevelsApi(request: RequestFn) {
  return {
    listReorderLevels: (params: ReorderLevelListParams) =>
      request<ApiReorderLevel[]>(`/reorder-levels${queryOf({ ...params })}`),
    setReorderLevel: (input: ReorderLevelInput) => request<ApiReorderLevel>('/reorder-levels', 'PUT', input),
    /** Applies one pair to every SKU of a style; answers how many it touched. */
    setReorderLevelByStyle: (input: ReorderLevelByStyleInput) =>
      request<{ styleId: string; skus: number }>('/reorder-levels/by-style', 'PUT', input),
    deleteReorderLevel: (id: string) => request<void>(`/reorder-levels/${id}`, 'DELETE'),
    /* The payload is not documented yet, so the caller normalises it. */
    replenishmentSuggestions: (branchId?: string) =>
      request<unknown>(`/replenishment/suggestions${queryOf({ branchId })}`),
  }
}

export type ReorderLevelsApi = ReturnType<typeof createReorderLevelsApi>
