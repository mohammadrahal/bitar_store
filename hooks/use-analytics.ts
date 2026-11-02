'use client'

import { useQuery } from '@tanstack/react-query'
import { useBranchesKey } from '@/hooks/use-stock'
import { queryKeys } from '@/lib/query-keys'
import {
  getSalesAnalyticsFromBranchSales,
  getSalesAnalyticsFromReports,
} from '@/services/analytics.service'
import { usePermission } from '@/hooks/use-permission'
import type { BranchScope } from '@/types'

/** Sales performance for the overview charts, scoped like every other figure. */
export function useSalesAnalytics(scope: BranchScope) {
  const branches = useBranchesKey()
  const { canViewFinancialReports } = usePermission()
  const useReports = canViewFinancialReports()
  const ready = branches !== null

  const reports = useQuery({
    queryKey: queryKeys.analytics.sales(scope, 'reports'),
    queryFn: () => getSalesAnalyticsFromReports(scope),
    enabled: ready && useReports,
    staleTime: 60_000,
  })

  const branchSales = useQuery({
    queryKey: queryKeys.analytics.sales(scope, 'sales'),
    queryFn: () => getSalesAnalyticsFromBranchSales(scope),
    enabled: ready && !useReports,
    staleTime: 60_000,
  })

  return useReports ? reports : branchSales
}
