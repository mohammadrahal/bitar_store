'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'
import {
  createSupplyInvoice,
  findSupplyInvoiceForTransfer,
} from '@/services/invoices-api.service'
import type { ApiTransferSupplyInvoice } from '@/lib/api/types'

/**
 * The supply invoice of one transfer, from `GET /invoices?transferId=`.
 *
 * `known` is `transfer.supplyInvoice`, which `GET /transfers/:id` now sends: a
 * `null` there means the server has already said this transfer has no live
 * invoice, so there is nothing to ask for. `undefined` is an older server that
 * does not send the field, and then the request decides.
 *
 * When `known` is an invoice the request still goes out, because the screens
 * need the full summary (`voided`, `reference`, totals) and the field on the
 * transfer carries four fields.
 */
export function useTransferSupplyInvoice(
  transferId: string,
  enabled: boolean,
  known?: ApiTransferSupplyInvoice | null,
) {
  return useQuery({
    queryKey: queryKeys.transfers.supplyInvoice(transferId),
    queryFn: () => findSupplyInvoiceForTransfer(transferId),
    enabled: enabled && Boolean(transferId) && known !== null,
    staleTime: 15_000,
  })
}

export function useCreateSupplyInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ transferId, note }: { transferId: string; note?: string }) =>
      createSupplyInvoice(transferId, note),
    onSuccess: async (invoice) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.apiInvoices.all })
      if (invoice.transfer?.id) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.transfers.supplyInvoice(invoice.transfer.id),
        })
        /* The transfer itself carries `supplyInvoice` now, so the detail screen
           is stale the moment one is raised. */
        await queryClient.invalidateQueries({
          queryKey: queryKeys.transfers.detail(invoice.transfer.id),
        })
      }
      toast.success(invoice.reference ? `Supply invoice ${invoice.reference}` : 'Supply invoice draft created')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
