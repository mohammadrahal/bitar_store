'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { usePermission } from '@/hooks/use-permission'
import { useBranchesKey } from '@/hooks/use-stock'
import { previousRangeOf, rangeOf, type RangeDays } from '@/lib/dashboard-range'
import { queryKeys } from '@/lib/query-keys'
import { getDashboardTrend, getTrendComparison } from '@/services/dashboard-trend.service'
import type { BranchScope } from '@/types'

/**
 * `keepPreviousData` is what lets the trend panel hold its last render while a
 * new range loads: changing 30 days to 90 should redraw the line, not collapse
 * the panel to a skeleton and shove everything below it up the page.
 */
export function useDashboardTrend(scope: BranchScope, days: RangeDays) {
  const { canViewFinancialReports } = usePermission()
  const branches = useBranchesKey()
  const range = rangeOf(days)
  return useQuery({
    queryKey: queryKeys.dashboard.trend(scope, days),
    queryFn: () => getDashboardTrend(scope, range),
    enabled: branches !== null && canViewFinancialReports(),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}

/** The window before the selected one, which the stat deltas compare against. */
export function useTrendComparison(scope: BranchScope, days: RangeDays) {
  const { canViewFinancialReports } = usePermission()
  const branches = useBranchesKey()
  const range = previousRangeOf(days)
  return useQuery({
    queryKey: queryKeys.dashboard.trendComparison(scope, days),
    queryFn: () => getTrendComparison(scope, range),
    enabled: branches !== null && canViewFinancialReports(),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}
