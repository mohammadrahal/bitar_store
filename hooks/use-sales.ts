'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { invalidateStockQueries } from '@/lib/invalidate-stock'
import { queryKeys, salesQueryKeys } from '@/lib/query-keys'
import { createSale, getSale, listSales, type NewSaleInput } from '@/services/sales.service'
import { isNoOpenCashSession } from '@/services/cash-sessions.service'

export function useSale(saleId: string) {
  return useQuery({
    queryKey: salesQueryKeys.detail(saleId),
    queryFn: () => getSale(saleId),
    enabled: Boolean(saleId),
  })
}

export function useSalesList(branchId: string, date?: string, enabled = true) {
  return useQuery({
    queryKey: salesQueryKeys.list(branchId, date ?? ''),
    queryFn: () => listSales({ branchId, date, limit: 200 }),
    enabled: Boolean(branchId) && enabled,
  })
}

export type { NewSaleInput, NewSaleLine } from '@/services/sales.service'

export function useCreateSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: NewSaleInput; idempotencyKey: string }) =>
      createSale(input, idempotencyKey),
    onSuccess: (sale) => {
      invalidateStockQueries(queryClient)
      void queryClient.invalidateQueries({ queryKey: salesQueryKeys.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.apiInvoices.all })
      /* The server attaches the sale to the branch's open drawer, so its
         expected cash moved the moment this returned. */
      void queryClient.invalidateQueries({ queryKey: queryKeys.cashSessions.all })
      toast.success(`Sale ${sale.reference} completed`)
    },
    onError: (error: Error) => {
      /* `requireOpenCashSession` is on and this branch has no open drawer. The
         till cannot fix that itself, so say what has to happen rather than
         repeating the server's sentence on its own. */
      if (isNoOpenCashSession(error)) {
        toast.error('This branch has no open cash session. Open the drawer, then ring the sale up again.')
        return
      }
      toast.error(error.message)
    },
  })
}
