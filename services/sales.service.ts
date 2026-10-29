import { getApiClient } from '@/lib/api'
import { priceText } from '@/lib/api/map-catalog'
import type { ApiSale, CreateSaleInput, SalesListParams } from '@/lib/api/types'

export async function createSale(input: CreateSaleInput, idempotencyKey: string): Promise<ApiSale> {
  return getApiClient().createSale(input, idempotencyKey)
}

export async function getSale(saleId: string): Promise<ApiSale> {
  return getApiClient().getSale(saleId)
}

export async function listSales(params: SalesListParams): Promise<{ businessDate: string; sales: ApiSale[] }> {
  return getApiClient().listSales(params)
}

/** Cash payment for the full total — enough for a completed in-store sale. */
export function cashPaymentForTotal(total: number) {
  const amount = priceText(total)
  return [{ method: 'cash' as const, amount, tendered: amount }]
}
