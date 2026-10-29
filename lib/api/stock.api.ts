import type { RequestFn } from '@/lib/api/client'
import { parseStockList } from '@/lib/api/map-stock'
import type { OpeningStockInput, OpeningStockResult, StockListParams } from '@/lib/api/types'

function queryOf(params: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }
  const text = query.toString()
  return text ? `?${text}` : ''
}

export function createStockApi(request: RequestFn) {
  return {
    listStock: async (params: StockListParams) => {
      const payload = await request<unknown>(`/stock${queryOf({ ...params })}`)
      return parseStockList(payload)
    },
    setOpeningStock: (input: OpeningStockInput, idempotencyKey: string) =>
      request<OpeningStockResult>('/stock/opening', 'POST', input, { idempotencyKey }),
  }
}

export type StockApi = ReturnType<typeof createStockApi>
