'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'
import {
  decideDiscountRequest,
  listDiscountRequests,
  openDiscountRequestsAt,
  requestDiscount,
  type NewDiscountRequest,
} from '@/services/discount-requests.service'
import type { BranchScope } from '@/types'

/** Pending and approved asks at the till's location, so a line can show its state. */
export function useOpenDiscountRequests(branchId: string) {
  return useQuery({
    queryKey: queryKeys.discountRequests.atBranch(branchId),
    queryFn: () => openDiscountRequestsAt(branchId),
    enabled: Boolean(branchId),
  })
}

export function useDiscountRequests(scope: BranchScope) {
  return useQuery({
    queryKey: queryKeys.discountRequests.list(scope),
    queryFn: () => listDiscountRequests(scope),
  })
}

export function useRequestDiscount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NewDiscountRequest) => requestDiscount(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.discountRequests.all })
      toast.success('Discount sent for approval')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useDecideDiscountRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ requestId, approved }: { requestId: string; approved: boolean }) =>
      decideDiscountRequest(requestId, approved),
    onSuccess: (request) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.discountRequests.all })
      toast.success(request.status === 'approved' ? 'Discount approved' : 'Discount rejected')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
