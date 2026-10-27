'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useBranches } from '@/hooks/use-branches'
import { queryKeys } from '@/lib/query-keys'
import { syncCatalog } from '@/services/catalog-sync.service'
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

/** Fetches the API catalog into the mock store. Resolves to the SKU count. */
export function useCatalogSync() {
  return useQuery({
    queryKey: queryKeys.products.catalog(),
    queryFn: syncCatalog,
    staleTime: 60_000,
  })
}

/**
 * Stock lives in the mock store while branches and the catalog come from the
 * API, and fetching them is what mirrors them in — which is what gives each
 * SKU its per-branch rows. So stock reads wait for both and are keyed by
 * them: they never run against an empty mirror, and a new branch or SKU
 * re-reads them rather than serving figures that predate it.
 */
export function useMirroredBranches(): string | null {
  const { data: branches } = useBranches()
  const { data: skuCount } = useCatalogSync()
  if (!branches || skuCount === undefined) return null
  const ids = branches
    .map((branch) => branch.id)
    .sort()
    .join(',')
  return `${ids}#${skuCount}`
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
