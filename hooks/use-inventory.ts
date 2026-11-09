'use client'

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useBranchesKey, useMirroredBranches } from '@/hooks/use-stock'
import { invalidateStockQueries } from '@/lib/invalidate-stock'
import { queryKeys } from '@/lib/query-keys'
import { getVariantDetail, listInventory, type InventoryQuery } from '@/services/inventory.service'
import { getOperationsSummary } from '@/services/operations.service'
import { searchVariants } from '@/services/products.service'
import { getWarehouseId, setWarehouse } from '@/services/locations.service'
import { useUserStore } from '@/store/user-store'
import type { BranchScope } from '@/types'

export function useInventory(query: InventoryQuery) {
  const branches = useBranchesKey()
  const mirrored = useMirroredBranches()
  /* "Out of stock" and "low" are answered over the whole catalog, so those two
     wait for the mirror; the rest only need what the locations report and would
     otherwise sit behind a full catalog sweep for no gain. */
  const wholeCatalog = query.filter === 'out' || query.filter === 'low'
  const ready = wholeCatalog ? mirrored !== null : branches !== null
  return useQuery({
    queryKey: [...queryKeys.stock.inventory(query.scope, query.filter, query.search), branches ?? ''],
    queryFn: () => listInventory(query),
    enabled: ready,
    staleTime: 30_000,
  })
}

export function useVariantDetail(variantId: string) {
  const mirrored = useMirroredBranches()
  return useQuery({
    queryKey: queryKeys.stock.variant(variantId),
    queryFn: () => getVariantDetail(variantId),
    enabled: mirrored !== null && Boolean(variantId),
  })
}

/**
 * The same per-location balances as `useVariantDetail`, for several variants at
 * once, under the same key each so a variant already read for the side card is
 * served from cache and one movement invalidates every view of it.
 *
 * The quick transfer drawer needs this shape: to cap a line at what the source
 * actually holds it has to know each selected variant's position at every
 * location before the source has even been chosen.
 */
export function useVariantDetails(variantIds: string[]) {
  const mirrored = useMirroredBranches()
  return useQueries({
    queries: variantIds.map((variantId) => ({
      queryKey: queryKeys.stock.variant(variantId),
      queryFn: () => getVariantDetail(variantId),
      enabled: mirrored !== null && Boolean(variantId),
    })),
  })
}

export function useOperationsSummary(scope: BranchScope, { enabled = true }: { enabled?: boolean } = {}) {
  const branches = useBranchesKey()
  return useQuery({
    queryKey: queryKeys.stock.operations(scope),
    queryFn: () => getOperationsSummary(scope),
    enabled: enabled && branches !== null,
    staleTime: 60_000,
  })
}

/** Sellable variants with what is available at `branchId`. Archived models never appear. */
export function useStockPicker(branchId: string, search: string, limit = 12) {
  const mirrored = useMirroredBranches()
  return useQuery({
    queryKey: queryKeys.stock.picker(branchId, `${search}|${limit}`),
    queryFn: () => searchVariants(search, limit, branchId),
    enabled: mirrored !== null && Boolean(branchId),
  })
}

export function useSetWarehouse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (branchId: string) => setWarehouse(branchId),
    onSuccess: (name) => {
      invalidateStockQueries(queryClient)
      void queryClient.invalidateQueries({ queryKey: queryKeys.branches.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.locations.warehouse() })
      toast.success(`${name} is now the main warehouse`)
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useWarehouseId(branchId?: string) {
  const branches = useBranchesKey()
  const token = useUserStore((state) => state.token)
  return useQuery({
    queryKey: [...queryKeys.locations.warehouse(), branches ?? '', branchId ?? ''],
    queryFn: () => getWarehouseId({ branchId }),
    enabled: branches !== null && Boolean(token),
  })
}
