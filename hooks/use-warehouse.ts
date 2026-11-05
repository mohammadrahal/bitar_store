'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { invalidateMinimumQueries } from '@/lib/invalidate-stock'
import { queryKeys } from '@/lib/query-keys'
import {
  deleteReorderLevel,
  fetchReplenishmentSuggestions,
  fetchStockOverview,
  listReorderLevels,
  setReorderLevel,
} from '@/services/warehouse.service'
import type { ReorderLevelInput } from '@/lib/api/types'

export function useStockNetwork(search: string, offset: number) {
  return useQuery({
    queryKey: queryKeys.warehouse.stockNetwork(search, offset),
    queryFn: () => fetchStockOverview({ search: search || undefined, limit: 50, offset, activeOnly: true }),
  })
}

export function useReorderLevels(branchId: string, search: string) {
  return useQuery({
    queryKey: queryKeys.warehouse.reorderLevels(branchId, search),
    queryFn: () => listReorderLevels({ branchId, search: search || undefined, limit: 200 }),
    enabled: Boolean(branchId),
  })
}

export function useSetReorderLevel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ReorderLevelInput) => setReorderLevel(input),
    onSuccess: () => {
      invalidateMinimumQueries(queryClient)
      toast.success('Minimum updated')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useDeleteReorderLevel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteReorderLevel(id),
    onSuccess: () => {
      invalidateMinimumQueries(queryClient)
      toast.success('Minimum removed')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useReplenishment(branchId: string) {
  return useQuery({
    queryKey: queryKeys.warehouse.replenishment(branchId),
    queryFn: () => fetchReplenishmentSuggestions(branchId || undefined),
  })
}
