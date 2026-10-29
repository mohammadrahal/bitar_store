'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'
import {
  cancelReplenishmentRequest,
  completeReplenishmentRequest,
  createReplenishmentRequest,
  listReplenishmentRequests,
  reviewReplenishmentRequest,
  type NewReplenishmentRequest,
  type ReplenishmentDecision,
  type ReplenishmentRequestQuery,
} from '@/services/replenishment-requests.service'

export function useReplenishmentRequests(query: ReplenishmentRequestQuery) {
  return useQuery({
    queryKey: queryKeys.replenishmentRequests.list(query.scope, query.status ?? 'all'),
    queryFn: () => listReplenishmentRequests(query),
  })
}

function useRequestCallbacks(message: (name: string) => string) {
  const queryClient = useQueryClient()
  return {
    onSuccess: (row: { number: string }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.replenishmentRequests.all })
      toast.success(message(row.number))
    },
    onError: (error: Error) => toast.error(error.message),
  }
}

export function useCreateReplenishmentRequest() {
  return useMutation({
    mutationFn: (input: NewReplenishmentRequest) => createReplenishmentRequest(input),
    ...useRequestCallbacks((number) => `${number} sent for review`),
  })
}

export function useReviewReplenishmentRequest() {
  return useMutation({
    mutationFn: (decision: ReplenishmentDecision) => reviewReplenishmentRequest(decision),
    ...useRequestCallbacks((number) => `${number} decided`),
  })
}

export function useCompleteReplenishmentRequest() {
  return useMutation({
    mutationFn: (requestId: string) => completeReplenishmentRequest(requestId),
    ...useRequestCallbacks((number) => `${number} completed`),
  })
}

export function useCancelReplenishmentRequest() {
  return useMutation({
    mutationFn: (requestId: string) => cancelReplenishmentRequest(requestId),
    ...useRequestCallbacks((number) => `${number} cancelled`),
  })
}
