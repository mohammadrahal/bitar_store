'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'
import { openingPostFor, postOpeningStock, type OpeningStock } from '@/services/opening-stock.service'

/** The posting already recorded for a location, or null while it is still open. */
export function useOpeningPost(branchId: string) {
  return useQuery({
    queryKey: queryKeys.openingStock.post(branchId),
    queryFn: () => openingPostFor(branchId),
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
      toast.success(`Opening stock posted: ${post.lines} ${post.lines === 1 ? 'line' : 'lines'}`)
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
