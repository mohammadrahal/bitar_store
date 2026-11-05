import type { PageRequestFn, RequestFn } from '@/lib/api/client'
import { queryOf } from '@/lib/api/query'
import type {
  ApiGoodsReceipt,
  ApiGoodsReceiptSummary,
  CreateGoodsReceiptInput,
  ListGoodsReceiptsParams,
} from '@/lib/api/types'

export function createGoodsReceiptsApi(request: RequestFn, pageRequest: PageRequestFn) {
  return {
    receiveGoods: (input: CreateGoodsReceiptInput, idempotencyKey: string) =>
      request<ApiGoodsReceipt>('/goods-receipts', 'POST', input, { idempotencyKey }),
    listGoodsReceiptsPage: (params: ListGoodsReceiptsParams = {}) =>
      pageRequest<ApiGoodsReceiptSummary>(`/goods-receipts${queryOf({ ...params })}`),
    getGoodsReceipt: (id: string) => request<ApiGoodsReceipt>(`/goods-receipts/${id}`),
  }
}

export type GoodsReceiptsApi = ReturnType<typeof createGoodsReceiptsApi>
