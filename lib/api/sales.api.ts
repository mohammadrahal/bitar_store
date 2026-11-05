import type { RequestFn, TotalRequestFn } from '@/lib/api/client'
import { queryOf } from '@/lib/api/query'
import type {
  ApiSale,
  ApiSaleHistoryRow,
  CreateSaleInput,
  SalesHistoryParams,
  SalesHistoryResult,
  SalesListParams,
  SalesListResult,
} from '@/lib/api/types'

export function createSalesApi(request: RequestFn, totalRequest: TotalRequestFn) {
  return {
    createSale: (input: CreateSaleInput, idempotencyKey: string) =>
      request<ApiSale>('/sales', 'POST', input, { idempotencyKey }),
    listSales: (params: SalesListParams) => request<SalesListResult>(`/sales${queryOf({ ...params })}`),
    getSale: (id: string) => request<ApiSale>(`/sales/${id}`),
    getSalesHistory: async (params: SalesHistoryParams = {}): Promise<SalesHistoryResult> => {
      const { data, total } = await totalRequest<{ from: string; to: string; sales: ApiSaleHistoryRow[] }>(
        `/sales/history${queryOf({ ...params })}`,
      )
      return { ...data, total }
    },
  }
}

export type SalesApi = ReturnType<typeof createSalesApi>
