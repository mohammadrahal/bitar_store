'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { getInvoice, listInvoices } from '@/services/invoices-api.service'
import type { ApiInvoiceKind } from '@/lib/api/types'

export const API_INVOICES_PAGE = 10

/** `GET /invoices` — the server's invoices, newest first. */
export function useApiInvoices({
  kind,
  branchId = '',
  offset = 0,
  enabled = true,
}: {
  kind?: ApiInvoiceKind
  branchId?: string
  offset?: number
  enabled?: boolean
}) {
  return useQuery({
    queryKey: queryKeys.apiInvoices.list(kind ?? 'any', branchId, offset),
    queryFn: () =>
      listInvoices({
        kind,
        branchId: branchId || undefined,
        limit: API_INVOICES_PAGE,
        offset,
      }),
    enabled,
    staleTime: 30_000,
  })
}

export function useApiInvoice(id: string) {
  return useQuery({
    queryKey: queryKeys.apiInvoices.detail(id),
    queryFn: () => getInvoice(id),
    enabled: Boolean(id),
  })
}
