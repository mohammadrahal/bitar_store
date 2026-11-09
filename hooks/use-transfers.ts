'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api/api-error'
import { invalidateStockQueries } from '@/lib/invalidate-stock'
import { clearDraftReservedCache } from '@/services/transfer-reservations.service'
import { queryKeys } from '@/lib/query-keys'
import {
  cancelTransfer,
  createTransfer,
  dispatchTransfer,
  getTransfer,
  listTransfersPageForScope,
  acceptTransfer,
  receiveTransfer,
  resolveTransfer,
  type TransferStatus,
} from '@/services/transfers.service'
import type { CreateTransferInput } from '@/lib/api/types'

export function useTransfersList(branchId: string, status: TransferStatus | '', offset: number) {
  return useQuery({
    queryKey: queryKeys.transfers.list(branchId, status, offset),
    queryFn: () => listTransfersPageForScope(branchId, status, 20, offset),
  })
}

export function useTransfer(id: string) {
  return useQuery({
    queryKey: queryKeys.transfers.detail(id),
    queryFn: () => getTransfer(id),
    enabled: Boolean(id),
  })
}

async function invalidateTransfers(queryClient: ReturnType<typeof useQueryClient>) {
  clearDraftReservedCache()
  invalidateStockQueries(queryClient)
  await queryClient.invalidateQueries({ queryKey: queryKeys.transfers.all })
  await queryClient.refetchQueries({ queryKey: queryKeys.transfers.all, type: 'active' })
}

export function useCreateTransfer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateTransferInput; idempotencyKey: string }) =>
      createTransfer(input, idempotencyKey),
    onSuccess: async (transfer) => {
      await invalidateTransfers(queryClient)
      toast.success(`Transfer ${transfer.reference} prepared`)
    },
    onError: (error: Error) => {
      const message = error.message
      const forbidden = error instanceof ApiError && error.status === 403
      if (forbidden || /prepare a transfer|ask the warehouse/i.test(message)) {
        toast.error(
          /prepare a transfer|ask the warehouse/i.test(message)
            ? message
            : 'The server refused this transfer. Employees should use Request replenishment (warehouse → your branch). Managers prepare other routes.',
        )
        return
      }
      toast.error(message)
    },
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
    onSuccess: async () => {
      await invalidateTransfers(queryClient)
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
      note,
    }: {
      id: string
      idempotencyKey: string
      lines: { skuId: string; accepted: number; damaged?: number }[]
      /** The inspector's remark on this pass, 1 to 500 characters. */
      note?: string
    }) => receiveTransfer(id, lines, idempotencyKey, note),
    onSuccess: async () => {
      await invalidateTransfers(queryClient)
      toast.success('Received. Stock is on hold until you accept it for sale')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useAcceptTransfer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      idempotencyKey,
      lines,
    }: {
      id: string
      idempotencyKey: string
      lines: { skuId: string; quantity: number }[]
    }) => acceptTransfer(id, lines, idempotencyKey),
    onSuccess: async () => {
      await invalidateTransfers(queryClient)
      toast.success('Stock released to the sellable shelf')
    },
    onError: (error: Error) => {
      const msg = error.message
      if (/not found|404|accept/i.test(msg)) {
        toast.error('Accept for sale needs the updated API (receive → on hold → accept). Restart or redeploy Bitar_Store.')
        return
      }
      toast.error(msg)
    },
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
    onSuccess: async () => {
      await invalidateTransfers(queryClient)
      toast.success('Missing units confirmed lost')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useCancelTransfer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => cancelTransfer(id),
    onSuccess: async () => {
      await invalidateTransfers(queryClient)
      toast.success('Draft cancelled')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
