'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { invalidateStockQueries } from '@/lib/invalidate-stock'
import { queryKeys } from '@/lib/query-keys'
import {
  cancelTransfer,
  createTransfer,
  dispatchTransfer,
  getTransfer,
  listTransfersPage,
  receiveTransfer,
  resolveTransfer,
  type TransferStatus,
} from '@/services/transfers.service'
import type { CreateTransferInput } from '@/lib/api/types'

export function useTransfersList(branchId: string, status: TransferStatus | '', offset: number) {
  return useQuery({
    queryKey: queryKeys.transfers.list(branchId, status, offset),
    queryFn: () =>
      listTransfersPage({
        branchId: branchId || undefined,
        status: status || undefined,
        limit: 20,
        offset,
      }),
  })
}

export function useTransfer(id: string) {
  return useQuery({
    queryKey: queryKeys.transfers.detail(id),
    queryFn: () => getTransfer(id),
    enabled: Boolean(id),
  })
}

function invalidateTransfers(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.transfers.all })
  invalidateStockQueries(queryClient)
}

export function useCreateTransfer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateTransferInput; idempotencyKey: string }) =>
      createTransfer(input, idempotencyKey),
    onSuccess: (transfer) => {
      invalidateTransfers(queryClient)
      toast.success(`Transfer ${transfer.reference} prepared`)
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useDispatchTransfer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      idempotencyKey,
      lines,
    }: {
      id: string
      idempotencyKey: string
      lines?: { skuId: string; quantity: number }[]
    }) => dispatchTransfer(id, idempotencyKey, lines),
    onSuccess: () => {
      invalidateTransfers(queryClient)
      toast.success('Transfer dispatched')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useReceiveTransfer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      idempotencyKey,
      lines,
    }: {
      id: string
      idempotencyKey: string
      lines: { skuId: string; accepted: number; damaged?: number }[]
    }) => receiveTransfer(id, lines, idempotencyKey),
    onSuccess: () => {
      invalidateTransfers(queryClient)
      toast.success('Receipt recorded')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useResolveTransfer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      reason,
      idempotencyKey,
      lines,
    }: {
      id: string
      reason: string
      idempotencyKey: string
      lines?: { skuId: string; quantity: number }[]
    }) => resolveTransfer(id, reason, idempotencyKey, lines),
    onSuccess: () => {
      invalidateTransfers(queryClient)
      toast.success('Missing units confirmed lost')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useCancelTransfer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => cancelTransfer(id),
    onSuccess: () => {
      invalidateTransfers(queryClient)
      toast.success('Draft cancelled')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
