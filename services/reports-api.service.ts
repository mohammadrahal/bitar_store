import { getApiClient } from '@/lib/api'
import type { ApiAuditEvent, ApiSalesSummary, ApiTopSkusResult, AuditEventParams, ReportRangeParams } from '@/lib/api/types'

export async function fetchSalesSummary(params: ReportRangeParams = {}): Promise<ApiSalesSummary> {
  return getApiClient().getSalesSummary(params)
}

export async function fetchTopSkus(params: ReportRangeParams & { limit?: number } = {}): Promise<ApiTopSkusResult> {
  return getApiClient().getTopSkus({ limit: 10, ...params })
}

export async function listAuditEvents(params: AuditEventParams = {}): Promise<ApiAuditEvent[]> {
  return getApiClient().listAuditEvents({ limit: 50, ...params })
}
