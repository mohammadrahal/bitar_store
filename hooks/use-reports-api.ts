'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { fetchSalesSummary, fetchTopSkus, listAuditEvents } from '@/services/reports-api.service'

export function useSalesSummaryReport(branchId: string, from: string, to: string) {
  return useQuery({
    queryKey: queryKeys.reports.summary(branchId, from, to),
    queryFn: () =>
      fetchSalesSummary({
        branchId: branchId || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
  })
}

export function useTopSkusReport(branchId: string, from: string, to: string) {
  return useQuery({
    queryKey: queryKeys.reports.topSkus(branchId, from, to),
    queryFn: () =>
      fetchTopSkus({
        branchId: branchId || undefined,
        from: from || undefined,
        to: to || undefined,
        limit: 10,
      }),
  })
}

export function useAuditEvents(offset: number, params: { entityType?: string; entityId?: string } = {}) {
  return useQuery({
    queryKey: [...queryKeys.reports.audit(offset), params.entityType ?? '', params.entityId ?? ''],
    queryFn: () => listAuditEvents({ limit: 50, offset, ...params }),
  })
}

export function useTransferAuditEvents(transferId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['reports', 'audit', 'transfer', transferId],
    queryFn: () => listAuditEvents({ entityType: 'transfer', entityId: transferId, limit: 50 }),
    enabled: enabled && Boolean(transferId),
  })
}
