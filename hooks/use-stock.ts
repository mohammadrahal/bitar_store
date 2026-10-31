'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useBranches } from '@/hooks/use-branches'
import { queryKeys } from '@/lib/query-keys'
import { syncCatalog } from '@/services/catalog-sync.service'
import { unitsByProduct, unitsByVariant } from '@/services/product-stock.service'
import { getBranchStockUnits, getStockOverview, listBranchStock } from '@/services/stock.service'
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
  return `${branchKey(branches)}#${skuCount}`
}

function branchKey(branches: { id: string }[]): string {
  return branches
    .map((branch) => branch.id)
    .sort()
    .join(',')
}

/**
 * The branch half of the gate above, for reads that never touch the mirrored
 * catalog. They would otherwise wait on a full catalog sweep to show figures
 * that do not depend on one.
 */
export function useBranchesKey(): string | null {
  const { data: branches } = useBranches()
  return branches ? branchKey(branches) : null
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

/** Units per model for the products list, narrowed by the header filter. */
export function useProductUnits(scope: BranchScope) {
  const branches = useBranchesKey()
  return useQuery({
    queryKey: queryKeys.stock.byProduct(scope),
    queryFn: () => unitsByProduct(scope),
    enabled: branches !== null,
  })
}

/** The same, per SKU of one model. */
export function useVariantUnits(productId: string, scope: BranchScope) {
  const branches = useBranchesKey()
  return useQuery({
    queryKey: queryKeys.stock.styleUnits(productId, scope),
    queryFn: () => unitsByVariant(productId, scope),
    enabled: branches !== null && Boolean(productId),
  })
}

/**
 * The stat cards. Gated on the catalog, because the Products card counts the
 * mirrored catalog rather than anything in scope.
 */
export function useStockOverview(scope: BranchScope) {
  const branches = useMirroredBranches()
  return useQuery({
    queryKey: queryKeys.stock.overview(scope, branches ?? ''),
    queryFn: () => getStockOverview(scope),
    enabled: branches !== null,
  })
}
