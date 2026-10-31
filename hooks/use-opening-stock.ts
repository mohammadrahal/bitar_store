'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'
import { openingStateFor, postOpeningStock, type OpeningStock } from '@/services/opening-stock.service'

/** Whether the location has been opened, and which SKUs are still openable. */
export function useOpeningState(branchId: string) {
  return useQuery({
    queryKey: queryKeys.openingStock.post(branchId),
    queryFn: () => openingStateFor(branchId),
    enabled: Boolean(branchId),
  })
}

export function usePostOpeningStock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: OpeningStock) => postOpeningStock(input),
    onSuccess: (post) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.openingStock.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
      toast.success(`Opening stock posted: ${post.lines} ${post.lines === 1 ? 'line' : 'lines'} at this location`)
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
