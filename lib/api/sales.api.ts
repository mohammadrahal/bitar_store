import type { RequestFn } from '@/lib/api/client'
import type { ApiSale, CreateSaleInput, SalesListParams, SalesListResult } from '@/lib/api/types'

function queryOf(params: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }
  const text = query.toString()
  return text ? `?${text}` : ''
}

export function createSalesApi(request: RequestFn) {
  return {
    createSale: (input: CreateSaleInput, idempotencyKey: string) =>
      request<ApiSale>('/sales', 'POST', input, { idempotencyKey }),
    listSales: (params: SalesListParams) => request<SalesListResult>(`/sales${queryOf({ ...params })}`),
    getSale: (id: string) => request<ApiSale>(`/sales/${id}`),
  }
}

export type SalesApi = ReturnType<typeof createSalesApi>
