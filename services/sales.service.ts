import { getApiClient } from '@/lib/api'
import { priceText } from '@/lib/api/map-catalog'
import type { ApiSale, CreateSaleInput, SalesListParams } from '@/lib/api/types'

/** A completed POS sale, named for the screens so they need no API types. */
export type { ApiSale as Sale, ApiSaleLine as SaleLine, ApiSalePayment as SalePayment } from '@/lib/api/types'

export interface NewSaleLine {
  skuId: string
  quantity: number
  unitPrice: number
  /** Percentage off this line. The API records who approved it. */
  discountPercent?: number
  discountReason?: string
}

export interface NewSalePayment {
  method: 'cash' | 'whish'
  amount: number
  /** Cash only: what the customer handed over, so the server can return change. */
  tendered?: number
  /** Whish only, and unique — the server refuses a reference it has seen. */
  reference?: string
}

export interface NewSaleInput {
  branchId: string
  note?: string
  lines: NewSaleLine[]
  payments: NewSalePayment[]
}

/**
 * Builds the `POST /sales` body. Prices are not sent: the server reads the
 * current catalog price, so the figures on screen are a preview of its answer.
 */
function toApiInput(input: NewSaleInput): CreateSaleInput {
  return {
    branchId: input.branchId,
    channel: 'in_store',
    note: input.note?.trim() || null,
    lines: input.lines.map((line) => ({
      skuId: line.skuId,
      quantity: line.quantity,
      discount:
        line.discountPercent && line.discountPercent > 0
          ? {
              type: 'percent',
              percent: String(line.discountPercent),
              reason: line.discountReason?.trim() || 'Sale discount',
            }
          : undefined,
    })),
    payments: input.payments.map((payment) =>
      payment.method === 'cash'
        ? {
            method: 'cash' as const,
            amount: priceText(payment.amount),
            tendered: priceText(payment.tendered ?? payment.amount),
          }
        : { method: 'whish' as const, amount: priceText(payment.amount), reference: payment.reference ?? '' },
    ),
  }
}

export async function createSale(input: NewSaleInput, idempotencyKey: string): Promise<ApiSale> {
  return getApiClient().createSale(toApiInput(input), idempotencyKey)
}

export async function getSale(saleId: string): Promise<ApiSale> {
  return getApiClient().getSale(saleId)
}

export async function listSales(params: SalesListParams): Promise<{ businessDate: string; sales: ApiSale[] }> {
  return getApiClient().listSales(params)
}
