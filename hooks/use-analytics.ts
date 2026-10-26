'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { getSalesAnalytics } from '@/services/analytics.service'
import type { BranchScope } from '@/types'

/** Sales performance for the overview charts, scoped like every other figure. */
export function useSalesAnalytics(scope: BranchScope) {
  return useQuery({
    queryKey: queryKeys.analytics.sales(scope),
    queryFn: () => getSalesAnalytics(scope),
  })
}
