import type { ApiPage, PageRequestFn, RequestFn } from '@/lib/api/client'
import { parseStockList } from '@/lib/api/map-stock'
import { queryOf } from '@/lib/api/query'
import type {
  ApiStockItem,
  ApiStockMovement,
  ApiStockOverview,
  OpeningStockInput,
  OpeningStockResult,
  StockListParams,
  StockMovementParams,
  StockOverviewParams,
} from '@/lib/api/types'

export function createStockApi(request: RequestFn, pageRequest: PageRequestFn) {
  return {
    listStock: async (params: StockListParams) => {
      const payload = await request<unknown>(`/stock${queryOf({ ...params })}`)
      return parseStockList(payload)
    },
    listStockPage: async (params: StockListParams): Promise<ApiPage<ApiStockItem>> => {
      const { items: payload, total } = await pageRequest<unknown>(`/stock${queryOf({ ...params })}`)
      return { items: parseStockList(payload), total }
    },
    setOpeningStock: (input: OpeningStockInput, idempotencyKey: string) =>
      request<OpeningStockResult>('/stock/opening', 'POST', input, { idempotencyKey }),
    getStockOverview: (params: StockOverviewParams = {}) =>
      request<ApiStockOverview>(`/stock/overview${queryOf({ ...params })}`),
    listStockMovements: (params: StockMovementParams) =>
      request<ApiStockMovement[]>(`/stock/movements${queryOf({ ...params })}`),
  }
}

export type StockApi = ReturnType<typeof createStockApi>
