'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useMirroredBranches } from '@/hooks/use-stock'
import { queryKeys } from '@/lib/query-keys'
import { getVariantDetail, listInventory, type InventoryQuery } from '@/services/inventory.service'
import { getOperationsSummary } from '@/services/operations.service'
import { searchVariants } from '@/services/products.service'
import { getWarehouseId, setWarehouse } from '@/services/locations.service'
import type { BranchScope } from '@/types'

export function useInventory(query: InventoryQuery) {
  const mirrored = useMirroredBranches()
  return useQuery({
    queryKey: [...queryKeys.stock.inventory(query.scope, query.filter, query.search), mirrored ?? ''],
    queryFn: () => listInventory(query),
    enabled: mirrored !== null,
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

export function useOperationsSummary(scope: BranchScope) {
  const mirrored = useMirroredBranches()
  return useQuery({
    queryKey: queryKeys.stock.operations(scope),
    queryFn: () => getOperationsSummary(scope),
    enabled: mirrored !== null,
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
      void queryClient.invalidateQueries()
      toast.success(`${name} is now the main warehouse`)
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useWarehouseId() {
  const mirrored = useMirroredBranches()
  return useQuery({
    queryKey: [...queryKeys.locations.warehouse(), mirrored ?? ''],
    queryFn: getWarehouseId,
    enabled: mirrored !== null,
  })
}
