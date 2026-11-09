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
    /**
     * `note` is the inspector's remark on this receiving pass (1 to 500
     * characters, 9 Nov). It comes back on `transfer.receipts[]`, which is what
     * the receiving report prints from.
     */
    receiveTransfer: (
      id: string,
      lines: { skuId: string; accepted: number; damaged?: number }[],
      idempotencyKey: string,
      note?: string,
    ) =>
      request<ApiTransfer>(
        `/transfers/${id}/receive`,
        'POST',
        { lines, ...(note?.trim() ? { note: note.trim() } : {}) },
        { idempotencyKey },
      ),
    acceptTransfer: (
      id: string,
      lines: { skuId: string; quantity: number }[],
      idempotencyKey: string,
    ) => request<ApiTransfer>(`/transfers/${id}/accept`, 'POST', { lines }, { idempotencyKey }),
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
