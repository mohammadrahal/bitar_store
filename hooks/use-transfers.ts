'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useMirroredBranches } from '@/hooks/use-stock'
import { queryKeys } from '@/lib/query-keys'
import {
  approveTransfer,
  cancelTransfer,
  createTransfer,
  dispatchTransfer,
  getTransfer,
  listTransfers,
  receiveTransfer,
  releaseReserved,
  reportDiscrepancy,
  type TransferQuery,
  type TransferRequestInput,
} from '@/services/transfers.service'
import type { LineQuantities, ReceiptLine } from '@/services/transfer-actions.service'
import type { TransferWithLinks } from '@/types'

export function useTransfers(query: TransferQuery) {
  const mirrored = useMirroredBranches()
  return useQuery({
    queryKey: queryKeys.transfers.list(query.scope, query.status),
    queryFn: () => listTransfers(query),
    enabled: mirrored !== null,
  })
}

export function useTransfer(transferId: string) {
  const mirrored = useMirroredBranches()
  return useQuery({
    queryKey: queryKeys.transfers.detail(transferId),
    queryFn: () => getTransfer(transferId),
    enabled: mirrored !== null && Boolean(transferId),
  })
}

/* Nothing is shown as done until the service answers: no optimistic stock. */
function useTransferMutation<TInput>(
  run: (input: TInput) => Promise<TransferWithLinks>,
  success: (transfer: TransferWithLinks) => string,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: (transfer) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.transfers.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      toast.success(success(transfer))
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

type Keyed<T> = T & { key: string }

export function useCreateTransfer() {
  return useTransferMutation(
    ({ input, key }: Keyed<{ input: TransferRequestInput }>) => createTransfer(input, key),
    (transfer) => `${transfer.number} requested`,
  )
}

export function useApproveTransfer() {
  return useTransferMutation(
    ({ id, quantities, key }: Keyed<{ id: string; quantities: LineQuantities }>) => approveTransfer(id, quantities, key),
    (transfer) => `${transfer.number} approved, ${transfer.totals.stillReserved} units reserved`,
  )
}

export function useDispatchTransfer() {
  return useTransferMutation(
    ({ id, quantities, key }: Keyed<{ id: string; quantities: LineQuantities }>) => dispatchTransfer(id, quantities, key),
    (transfer) => `${transfer.number} dispatched, ${transfer.totals.inTransit} in transit`,
  )
}

export function useReceiveTransfer() {
  return useTransferMutation(
    ({ id, receipt, reason, key }: Keyed<{ id: string; receipt: Record<string, ReceiptLine>; reason: string }>) =>
      receiveTransfer(id, receipt, reason, key),
    (transfer) => `${transfer.number} receipt confirmed`,
  )
}

export function useReleaseReserved() {
  return useTransferMutation(
    ({ id, key }: Keyed<{ id: string }>) => releaseReserved(id, key),
    (transfer) => `${transfer.number}: reservation released`,
  )
}

export function useReportDiscrepancy() {
  return useTransferMutation(
    ({ id, note, key }: Keyed<{ id: string; note: string }>) => reportDiscrepancy(id, note, key),
    (transfer) => `${transfer.number}: discrepancy recorded`,
  )
}

export function useCancelTransfer() {
  return useTransferMutation(
    ({ id, reason, key }: Keyed<{ id: string; reason: string }>) => cancelTransfer(id, reason, key),
    (transfer) => `${transfer.number} cancelled`,
  )
}
