import type { RequestFn } from '@/lib/api/client'
import { queryOf } from '@/lib/api/query'
import type {
  ApiAuditEvent,
  ApiSalesSummary,
  ApiTopSkusResult,
  AuditEventParams,
  ReportRangeParams,
} from '@/lib/api/types'

export function createReportsApi(request: RequestFn) {
  return {
    /** Needs `reports.financial`. */
    getSalesSummary: (params: ReportRangeParams = {}) =>
      request<ApiSalesSummary>(`/reports/sales-summary${queryOf({ ...params })}`),
    getTopSkus: (params: ReportRangeParams & { limit?: number } = {}) =>
      request<ApiTopSkusResult>(`/reports/top-skus${queryOf({ ...params })}`),
    listAuditEvents: (params: AuditEventParams = {}) =>
      request<ApiAuditEvent[]>(`/audit-events${queryOf({ ...params })}`),
  }
}

export type ReportsApi = ReturnType<typeof createReportsApi>
