'use client'

import { useQuery } from '@tanstack/react-query'
import { useBranchesKey } from '@/hooks/use-stock'
import { usePermission } from '@/hooks/use-permission'
import { queryKeys } from '@/lib/query-keys'
import { getDashboardOverview } from '@/services/dashboard.service'
import type { BranchScope } from '@/types'

/** `GET /dashboard/overview` for users with `reports.financial`. */
export function useDashboardOverview(scope: BranchScope) {
  const { canViewFinancialReports } = usePermission()
  const branches = useBranchesKey()
  return useQuery({
    queryKey: queryKeys.dashboard.overview(scope),
    queryFn: () => getDashboardOverview(scope),
    enabled: branches !== null && canViewFinancialReports(),
  })
}
