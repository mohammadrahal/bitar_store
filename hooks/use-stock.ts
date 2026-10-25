'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { getBranchStockUnits, getInventoryStats, listLowStock } from '@/services/stock.service'
import type { BranchScope } from '@/types'

export function useBranchStockUnits(branchId: string) {
  return useQuery({
    queryKey: queryKeys.stock.byBranch(branchId),
    queryFn: () => getBranchStockUnits(branchId),
    enabled: Boolean(branchId),
  })
}

export function useInventoryStats(scope: BranchScope) {
  return useQuery({
    queryKey: queryKeys.stock.stats(scope),
    queryFn: () => getInventoryStats(scope),
  })
}

export function useLowStock(scope: BranchScope) {
  return useQuery({
    queryKey: queryKeys.stock.lowStock(scope),
    queryFn: () => listLowStock(scope),
  })
}
