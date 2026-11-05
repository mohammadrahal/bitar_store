import type { RequestFn } from '@/lib/api/client'
import { queryOf } from '@/lib/api/query'
import type {
  ApiReplenishmentSuggestions,
  ApiReorderLevel,
  ReorderLevelByStyleInput,
  ReorderLevelInput,
  ReorderLevelListParams,
} from '@/lib/api/types'

/** Per-branch minimums and replenishment suggestions (`adjustments.create`). */
export function createReorderLevelsApi(request: RequestFn) {
  return {
    listReorderLevels: (params: ReorderLevelListParams) =>
      request<ApiReorderLevel[]>(`/reorder-levels${queryOf({ ...params })}`),
    setReorderLevel: (input: ReorderLevelInput) => request<ApiReorderLevel>('/reorder-levels', 'PUT', input),
    setReorderLevelForStyle: (input: ReorderLevelByStyleInput) =>
      request<{ styleId: string; skus: number }>('/reorder-levels/by-style', 'PUT', input),
    deleteReorderLevel: (id: string) => request<void>(`/reorder-levels/${id}`, 'DELETE'),
    getReplenishmentSuggestions: (params: { branchId?: string } = {}) =>
      request<ApiReplenishmentSuggestions>(`/replenishment/suggestions${queryOf({ ...params })}`),
  }
}

export type ReorderLevelsApi = ReturnType<typeof createReorderLevelsApi>
