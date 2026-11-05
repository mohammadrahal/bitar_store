'use client'

import { useQuery } from '@tanstack/react-query'
import { useMirroredBranches } from '@/hooks/use-stock'
import { queryKeys } from '@/lib/query-keys'
import { getStockHealth } from '@/services/stock-health.service'
import type { BranchScope } from '@/types'

/**
 * The low-stock and out-of-stock counts, in variants. Gated on the mirrored
 * catalog because the non-admin path takes its variant list from the mirror: a
 * branch reports no row at all for something it has never held, and those are
 * exactly the variants that are out.
 */
export function useStockHealth(scope: BranchScope) {
  const branches = useMirroredBranches()
  return useQuery({
    queryKey: queryKeys.stock.health(scope, branches ?? ''),
    queryFn: () => getStockHealth(scope),
    enabled: branches !== null,
    staleTime: 30_000,
  })
}
