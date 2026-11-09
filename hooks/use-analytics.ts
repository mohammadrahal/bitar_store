'use client'

import { useQuery } from '@tanstack/react-query'
import { useBranchesKey } from '@/hooks/use-stock'
import { rangeOf, type RangeDays } from '@/lib/dashboard-range'
import { queryKeys } from '@/lib/query-keys'
import {
  getSalesAnalyticsFromBranchSales,
  getSalesAnalyticsFromReports,
} from '@/services/analytics.service'
import { usePermission } from '@/hooks/use-permission'
import type { BranchScope } from '@/types'

/**
 * Sales performance for the overview charts, scoped like every other figure and
 * over the window the page is showing.
 *
 * Only the reports path can answer for a window: `GET /sales` is a single shop
 * day, so a viewer without `reports.financial` gets today and the panel says so
 * rather than labelling today's figures with the chosen period.
 */
export function useSalesAnalytics(scope: BranchScope, days?: RangeDays, telemetryAllowed = true) {
  const branches = useBranchesKey()
  const { canViewFinancialReports } = usePermission()
  const useReports = canViewFinancialReports()
  const ready = branches !== null && telemetryAllowed
  const range = days ? rangeOf(days) : undefined

  const reports = useQuery({
    queryKey: queryKeys.analytics.sales(scope, 'reports', days),
    queryFn: () => getSalesAnalyticsFromReports(scope, range),
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

/** True when the figures can only ever cover today, whatever the range says. */
export function useAnalyticsCoversRange() {
  const { canViewFinancialReports } = usePermission()
  return canViewFinancialReports()
}
