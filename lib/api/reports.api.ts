import type { RequestFn } from '@/lib/api/client'
import { queryOf } from '@/lib/api/query'
import type { AuditEventParams, ReportRangeParams } from '@/lib/api/types'

/**
 * Figures the server totals itself, and the audit trail. The response shapes
 * are not in the API document yet, so each one is handed back as `unknown`
 * for the service that reads it to normalise, the way stock rows are.
 */
export function createReportsApi(request: RequestFn) {
  return {
    /** Needs `reports.financial`. */
    salesSummary: (params: ReportRangeParams) => request<unknown>(`/reports/sales-summary${queryOf({ ...params })}`),
    topSkus: (params: ReportRangeParams & { limit?: number }) =>
      request<unknown>(`/reports/top-skus${queryOf({ ...params })}`),
    /** Admin only. */
    auditEvents: (params: AuditEventParams = {}) => request<unknown>(`/audit-events${queryOf({ ...params })}`),
  }
}

export type ReportsApi = ReturnType<typeof createReportsApi>
