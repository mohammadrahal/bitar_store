import type { ApiPage, PageRequestFn, RequestFn } from '@/lib/api/client'
import { parseStockList } from '@/lib/api/map-stock'
import { queryOf } from '@/lib/api/query'
import type {
  ApiStockAdjustment,
  ApiStockItem,
  ApiStockMovement,
  ApiStockOverview,
  OpeningStockInput,
  OpeningStockResult,
  StockAdjustmentInput,
  StockAdjustmentParams,
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
    /* One SKU per call, and the key must be new each time or the server replays
       the first answer. which is what stops a double-click from counting the
       same delivery twice. */
    createStockAdjustment: (input: StockAdjustmentInput, idempotencyKey: string) =>
      request<ApiStockAdjustment>('/stock/adjustments', 'POST', input, { idempotencyKey }),
    listStockAdjustments: (params: StockAdjustmentParams = {}) =>
      request<ApiStockAdjustment[]>(`/stock/adjustments${queryOf({ ...params })}`),
    listAdjustmentsPage: (params: StockAdjustmentParams = {}) =>
      pageRequest<ApiStockAdjustment>(`/stock/adjustments${queryOf({ ...params })}`),
  }
}

export type StockApi = ReturnType<typeof createStockApi>
