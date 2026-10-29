'use client'

import { useQuery } from '@tanstack/react-query'
import { useBranchesKey } from '@/hooks/use-stock'
import { queryKeys } from '@/lib/query-keys'
import { getSalesAnalytics } from '@/services/analytics.service'
import type { BranchScope } from '@/types'

/** Sales performance for the overview charts, scoped like every other figure. */
export function useSalesAnalytics(scope: BranchScope) {
  const branches = useBranchesKey()
  return useQuery({
    queryKey: queryKeys.analytics.sales(scope),
    queryFn: () => getSalesAnalytics(scope),
    enabled: branches !== null,
  })
}
