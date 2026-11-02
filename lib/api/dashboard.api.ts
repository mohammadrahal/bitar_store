import type { RequestFn } from '@/lib/api/client'
import { queryOf } from '@/lib/api/query'
import type { ApiDashboardOverview, DashboardOverviewParams } from '@/lib/api/types'

export function createDashboardApi(request: RequestFn) {
  return {
    /** Needs `reports.financial`. Revenue is a two-decimal string. */
    getDashboardOverview: (params: DashboardOverviewParams = {}) =>
      request<ApiDashboardOverview>(`/dashboard/overview${queryOf({ ...params })}`),
  }
}

export type DashboardApi = ReturnType<typeof createDashboardApi>
