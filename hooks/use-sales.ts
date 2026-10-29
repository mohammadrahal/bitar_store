'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys, salesQueryKeys } from '@/lib/query-keys'
import type { CreateSaleInput } from '@/lib/api/types'
import { cashPaymentForTotal, createSale, getSale, listSales } from '@/services/sales.service'

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

export interface NewSaleInput {
  branchId: string
  note?: string
  lines: { skuId: string; quantity: number; unitPrice: number }[]
  /** Cart-level discount in currency; spread as an equal percent on each line when allowed. */
  discount?: number
  canDiscount: boolean
}

export function useCreateSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: NewSaleInput; idempotencyKey: string }) => {
      const subtotal = input.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
      const discount = input.canDiscount ? (input.discount ?? 0) : 0
      const total = Math.max(0, subtotal - discount)
      const percent =
        discount > 0 && subtotal > 0 ? ((discount / subtotal) * 100).toFixed(2) : null

      const body: CreateSaleInput = {
        branchId: input.branchId,
        channel: 'in_store',
        note: input.note?.trim() || null,
        lines: input.lines.map((line) => ({
          skuId: line.skuId,
          quantity: line.quantity,
          discount:
            percent && input.canDiscount
              ? { type: 'percent', percent, reason: 'Sale discount' }
              : undefined,
        })),
        payments: cashPaymentForTotal(total),
      }
      return createSale(body, idempotencyKey)
    },
    onSuccess: (sale) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
      void queryClient.invalidateQueries({ queryKey: salesQueryKeys.all })
      toast.success(`Sale ${sale.reference} completed`)
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

/** Server totals use catalog prices; this is for the footer before submit. */
export function previewSaleTotal(lines: { quantity: number; unitPrice: number }[], discount = 0) {
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
  return Math.max(0, subtotal - discount)
}
