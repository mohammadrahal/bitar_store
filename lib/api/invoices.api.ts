import { ApiError } from '@/lib/api/api-error'
import type { PageRequestFn, RequestFn } from '@/lib/api/client'
import { getApiBaseUrl } from '@/lib/api/client'
import { queryOf } from '@/lib/api/query'
import type {
  ApiInvoice,
  ApiInvoiceSummary,
  CreateInvoiceInput,
  ListInvoicesParams,
} from '@/lib/api/types'

export function createInvoicesApi(request: RequestFn, pageRequest: PageRequestFn, token: string) {
  return {
    createInvoice: (input: CreateInvoiceInput) => request<ApiInvoice>('/invoices', 'POST', input),
    listInvoicesPage: (params: ListInvoicesParams = {}) =>
      pageRequest<ApiInvoiceSummary>(`/invoices${queryOf({ ...params })}`),
    getInvoice: (id: string) => request<ApiInvoice>(`/invoices/${id}`),
    updateInvoicePrices: (
      id: string,
      input: { lines?: { skuId: string; unitPrice: string | number }[]; note?: string },
    ) => request<ApiInvoice>(`/invoices/${id}`, 'PATCH', input),
    finalizeInvoice: (id: string) => request<ApiInvoice>(`/invoices/${id}/finalize`, 'POST'),
    voidInvoice: (id: string, reason: string) =>
      request<ApiInvoice>(`/invoices/${id}/void`, 'POST', { reason }),
    deleteInvoice: (id: string) => request<void>(`/invoices/${id}`, 'DELETE'),
    downloadInvoicePdf: async (id: string): Promise<Blob> => {
      const response = await fetch(`${getApiBaseUrl()}/invoices/${id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null
        throw new ApiError(response.status, data?.message ?? 'Could not load the invoice')
      }
      return response.blob()
    },
  }
}

export type InvoicesApi = ReturnType<typeof createInvoicesApi>
