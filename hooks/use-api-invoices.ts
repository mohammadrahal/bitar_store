'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isApiError } from '@/lib/api/api-error'
import { queryKeys } from '@/lib/query-keys'
import {
  finalizeInvoice,
  getInvoice,
  listInvoices,
  updateInvoicePrices,
  voidInvoice,
} from '@/services/invoices-api.service'
import type { ApiInvoiceKind, ApiInvoiceStatus } from '@/lib/api/types'

export const API_INVOICES_PAGE = 10
export const API_INVOICES_LEDGER_LIMIT = 200

/** `GET /invoices`. the server's invoices, newest first. */
export function useApiInvoices({
  kind,
  branchId = '',
  offset = 0,
  status,
  search,
  from,
  to,
  limit = API_INVOICES_PAGE,
  enabled = true,
}: {
  kind?: ApiInvoiceKind
  branchId?: string
  offset?: number
  status?: ApiInvoiceStatus
  search?: string
  from?: string
  to?: string
  limit?: number
  enabled?: boolean
}) {
  const scope = JSON.stringify({ kind, branchId, offset, status, search, from, to, limit })
  return useQuery({
    queryKey: queryKeys.apiInvoices.list(scope),
    queryFn: () =>
      listInvoices({
        kind,
        branchId: branchId || undefined,
        status,
        search: search || undefined,
        from,
        to,
        limit,
        offset,
      }),
    enabled,
    staleTime: 30_000,
  })
}

export function useApiInvoice(id: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.apiInvoices.detail(id),
    queryFn: () => getInvoice(id),
    enabled: enabled && Boolean(id),
    retry: (failureCount, error) => {
      if (isApiError(error) && error.status === 404) return false
      return failureCount < 2
    },
  })
}

async function refreshInvoiceQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  invoice: { id: string; transfer?: { id: string } | null },
) {
  await queryClient.invalidateQueries({ queryKey: queryKeys.apiInvoices.detail(invoice.id) })
  await queryClient.invalidateQueries({ queryKey: queryKeys.apiInvoices.all })
  if (invoice.transfer?.id) {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.transfers.supplyInvoice(invoice.transfer.id),
    })
    await queryClient.invalidateQueries({ queryKey: queryKeys.transfers.detail(invoice.transfer.id) })
  }
}

export function useFinalizeInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => finalizeInvoice(id),
    onSuccess: async (invoice) => {
      await refreshInvoiceQueries(queryClient, invoice)
      toast.success(invoice.reference ? `Invoice ${invoice.reference} finalized` : 'Invoice finalized')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useUpdateInvoicePrices() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: { lines?: { skuId: string; unitPrice: string | number }[]; note?: string }
    }) => updateInvoicePrices(id, input),
    onSuccess: async (invoice) => {
      await refreshInvoiceQueries(queryClient, invoice)
      toast.success('Invoice updated')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useVoidInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => voidInvoice(id, reason),
    onSuccess: async (invoice) => {
      await refreshInvoiceQueries(queryClient, invoice)
      toast.success('Invoice voided')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
