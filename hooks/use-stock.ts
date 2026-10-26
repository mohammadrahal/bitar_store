'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useBranches } from '@/hooks/use-branches'
import { queryKeys } from '@/lib/query-keys'
import {
  getBranchStockUnits,
  getInventoryStats,
  listBranchStock,
  listLowStock,
  setLowStockAt,
  type LowStockAtInput,
} from '@/services/stock.service'
import type { BranchScope } from '@/types'

export function useBranchStockUnits(branchId: string) {
  return useQuery({
    queryKey: queryKeys.stock.byBranch(branchId),
    queryFn: () => getBranchStockUnits(branchId),
    enabled: Boolean(branchId),
  })
}

/**
 * Stock lives in the mock catalog while branches come from the API, and
 * fetching the branch list is what mirrors them into the catalog — which is
 * what gives each variant its per-branch rows. So both stock reads wait for
 * the branch list and are keyed by it: they never run against an empty mirror,
 * and a new branch re-reads them rather than serving figures that predate it.
 */
function useMirroredBranches(): string | null {
  const { data: branches } = useBranches()
  if (!branches) return null
  return branches
    .map((branch) => branch.id)
    .sort()
    .join(',')
}

/* Rows, not the quantity map: hooks/use-invoices.ts owns useBranchStock. */
export function useBranchStockRows(branchId: string) {
  const branches = useMirroredBranches()
  return useQuery({
    queryKey: queryKeys.stock.branchList(branchId),
    queryFn: () => listBranchStock(branchId),
    enabled: branches !== null && Boolean(branchId),
  })
}

export function useSetLowStockAt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: LowStockAtInput) => setLowStockAt(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useInventoryStats(scope: BranchScope) {
  const branches = useMirroredBranches()
  return useQuery({
    queryKey: queryKeys.stock.stats(scope, branches ?? ''),
    queryFn: () => getInventoryStats(scope),
    enabled: branches !== null,
  })
}

export function useLowStock(scope: BranchScope) {
  const branches = useMirroredBranches()
  return useQuery({
    queryKey: queryKeys.stock.lowStock(scope, branches ?? ''),
    queryFn: () => listLowStock(scope),
    enabled: branches !== null,
  })
}
