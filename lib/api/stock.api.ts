import type { RequestFn } from '@/lib/api/client'
import { parseStockList } from '@/lib/api/map-stock'
import { queryOf } from '@/lib/api/query'
import type {
  OpeningStockInput,
  OpeningStockResult,
  StockListParams,
  StockMovementParams,
  StockOverviewParams,
} from '@/lib/api/types'

export function createStockApi(request: RequestFn) {
  return {
    listStock: async (params: StockListParams) => {
      const payload = await request<unknown>(`/stock${queryOf({ ...params })}`)
      return parseStockList(payload)
    },
    setOpeningStock: (input: OpeningStockInput, idempotencyKey: string) =>
      request<OpeningStockResult>('/stock/opening', 'POST', input, { idempotencyKey }),
    /* Admin only, and every branch at once; the shape is not documented yet. */
    stockOverview: (params: StockOverviewParams = {}) => request<unknown>(`/stock/overview${queryOf({ ...params })}`),
    /* Needs `adjustments.create`. The server's movement log, which the variant
       page still reads from the local ledger. */
    listStockMovements: (params: StockMovementParams = {}) =>
      request<unknown>(`/stock/movements${queryOf({ ...params })}`),
  }
}

export type StockApi = ReturnType<typeof createStockApi>
