import type { PageRequestFn, RequestFn } from '@/lib/api/client'
import { queryOf } from '@/lib/api/query'
import type {
  ApiTransfer,
  CreateTransferInput,
  ListTransfersParams,
} from '@/lib/api/types'

export function createTransfersApi(request: RequestFn, pageRequest: PageRequestFn) {
  return {
    listTransfersPage: (params: ListTransfersParams = {}) =>
      pageRequest<ApiTransfer>(`/transfers${queryOf({ ...params })}`),
    getTransfer: (id: string) => request<ApiTransfer>(`/transfers/${id}`),
    createTransfer: (input: CreateTransferInput, idempotencyKey: string) =>
      request<ApiTransfer>('/transfers', 'POST', input, { idempotencyKey }),
    dispatchTransfer: (id: string, idempotencyKey: string, lines?: { skuId: string; quantity: number }[]) =>
      request<ApiTransfer>(`/transfers/${id}/dispatch`, 'POST', lines ? { lines } : {}, { idempotencyKey }),
    receiveTransfer: (
      id: string,
      lines: { skuId: string; accepted: number; damaged?: number }[],
      idempotencyKey: string,
    ) => request<ApiTransfer>(`/transfers/${id}/receive`, 'POST', { lines }, { idempotencyKey }),
    resolveTransfer: (
      id: string,
      reason: string,
      idempotencyKey: string,
      lines?: { skuId: string; quantity: number }[],
    ) =>
      request<ApiTransfer>(`/transfers/${id}/resolve`, 'POST', { reason, ...(lines ? { lines } : {}) }, { idempotencyKey }),
    cancelTransfer: (id: string) => request<ApiTransfer>(`/transfers/${id}/cancel`, 'POST'),
  }
}

export type TransfersApi = ReturnType<typeof createTransfersApi>
