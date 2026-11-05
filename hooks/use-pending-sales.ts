'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { salesQueryKeys } from '@/lib/query-keys'
import {
  deletePendingSale,
  listPendingSales,
  savePendingSale,
  type PendingSale,
} from '@/services/pending-sales.service'

export function usePendingSales(branchId: string) {
  return useQuery({
    queryKey: salesQueryKeys.pendingSales(branchId),
    queryFn: () => listPendingSales(branchId || undefined),
  })
}

export function useSavePendingSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof savePendingSale>[0]) => Promise.resolve(savePendingSale(input)),
    onSuccess: (sale) => {
      void queryClient.invalidateQueries({ queryKey: salesQueryKeys.pendingSales(sale.branchId) })
    },
  })
}

export function useDeletePendingSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; branchId: string }) => {
      deletePendingSale(id)
      return Promise.resolve()
    },
    onSuccess: (_, { branchId }) => {
      void queryClient.invalidateQueries({ queryKey: salesQueryKeys.pendingSales(branchId) })
    },
  })
}

export type { PendingSale }
