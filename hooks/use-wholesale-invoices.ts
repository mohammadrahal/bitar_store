'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invoiceQueryKeys } from '@/lib/query-keys'
import {
  deleteWholesaleInvoice,
  listWholesaleInvoices,
  saveWholesaleInvoice,
  type WholesaleInvoice,
  type WholesaleInvoiceStatus,
} from '@/services/wholesale-invoices.service'

export function useWholesaleInvoices(branchId: string, status?: WholesaleInvoiceStatus) {
  return useQuery({
    queryKey: invoiceQueryKeys.list(branchId, status ?? 'all'),
    queryFn: () => listWholesaleInvoices(branchId || undefined, status),
  })
}

export function useWholesaleInvoice(id: string) {
  return useQuery({
    queryKey: invoiceQueryKeys.detail(id),
    queryFn: async () => {
      const { getWholesaleInvoice } = await import('@/services/wholesale-invoices.service')
      const row = getWholesaleInvoice(id)
      if (!row) throw new Error('Invoice not found')
      return row
    },
    enabled: Boolean(id),
  })
}

export function useSaveWholesaleInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof saveWholesaleInvoice>[0]) => Promise.resolve(saveWholesaleInvoice(input)),
    onSuccess: (invoice) => {
      void queryClient.invalidateQueries({ queryKey: invoiceQueryKeys.all })
      void queryClient.invalidateQueries({ queryKey: invoiceQueryKeys.detail(invoice.id) })
    },
  })
}

export function useDeleteWholesaleInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string }) => {
      deleteWholesaleInvoice(id)
      return Promise.resolve()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invoiceQueryKeys.all })
    },
  })
}

export type { WholesaleInvoice, WholesaleInvoiceStatus }
