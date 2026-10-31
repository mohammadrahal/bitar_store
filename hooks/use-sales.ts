'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys, salesQueryKeys } from '@/lib/query-keys'
import { createSale, getSale, listSales, type NewSaleInput } from '@/services/sales.service'

export function useSale(saleId: string) {
  return useQuery({
    queryKey: salesQueryKeys.detail(saleId),
    queryFn: () => getSale(saleId),
    enabled: Boolean(saleId),
  })
}

export function useSalesList(branchId: string, date?: string) {
  return useQuery({
    queryKey: salesQueryKeys.list(branchId, date ?? ''),
    queryFn: () => listSales({ branchId, date, limit: 200 }),
    enabled: Boolean(branchId),
  })
}

export type { NewSaleInput, NewSaleLine } from '@/services/sales.service'

export function useCreateSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: NewSaleInput; idempotencyKey: string }) =>
      createSale(input, idempotencyKey),
    onSuccess: (sale) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
      void queryClient.invalidateQueries({ queryKey: salesQueryKeys.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all })
      toast.success(`Sale ${sale.reference} completed`)
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
