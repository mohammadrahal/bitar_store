'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useBranchScope } from '@/hooks/use-branch-scope'
import { usePermission } from '@/hooks/use-permission'
import { useBranchesKey } from '@/hooks/use-stock'
import { invalidateStockQueries } from '@/lib/invalidate-stock'
import { queryKeys } from '@/lib/query-keys'
import {
  deleteStockReceipt,
  fetchStockAdjustments,
  listStockReceipts,
  postStockCorrection,
  type StockCorrection,
} from '@/services/stock-receipts.service'

/**
 * Legacy receipt documents left in this browser, narrowed to the locations in
 * scope. Read-only: deliveries are recorded through `usePostGoodsReceipt` now.
 */
export function useStockReceipts() {
  const scope = useBranchScope()
  const branches = useBranchesKey()
  return useQuery({
    queryKey: queryKeys.stock.receipts(scope),
    queryFn: () => listStockReceipts(scope),
    /* The branch list decides which receipts are in scope, so the read waits
       for it rather than returning an empty list that looks like "none". */
    enabled: branches !== null,
    /* Local storage: there is nothing for it to go stale against. */
    staleTime: Infinity,
  })
}

/** Corrections the server knows about, whoever made them and wherever from. */
export function useStockAdjustments() {
  const scope = useBranchScope()
  const branches = useBranchesKey()
  const { can } = usePermission()
  return useQuery({
    queryKey: queryKeys.stock.adjustments(scope),
    queryFn: () => fetchStockAdjustments(scope),
    enabled: branches !== null && can('stock.view'),
    staleTime: 60_000,
  })
}

/** One variant, one location: the counted-quantity correction. */
export function usePostStockCorrection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: StockCorrection) => postStockCorrection(input),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: ['stock', 'adjustments'] })
      invalidateStockQueries(queryClient)
      const delta = input.quantityDelta
      toast.success(
        delta > 0
          ? `Added ${delta} ${delta === 1 ? 'piece' : 'pieces'}`
          : `Removed ${Math.abs(delta)} ${Math.abs(delta) === 1 ? 'piece' : 'pieces'}`,
      )
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useDeleteStockReceipt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteStockReceipt(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stock', 'receipts'] })
      toast.success('Receipt and its photo removed from this device. The stock it placed stays where it is.')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
