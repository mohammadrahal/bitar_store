import { getApiClient } from '@/lib/api'
import type { ApiTransfer, CreateTransferInput, ListTransfersParams, TransferStatus } from '@/lib/api/types'

export type { ApiTransfer as Transfer, TransferStatus } from '@/lib/api/types'

export async function listTransfersPage(params: ListTransfersParams = {}) {
  return getApiClient().listTransfersPage({ limit: 20, ...params })
}

export async function getTransfer(id: string): Promise<ApiTransfer> {
  return getApiClient().getTransfer(id)
}

export async function createTransfer(input: CreateTransferInput, idempotencyKey: string): Promise<ApiTransfer> {
  return getApiClient().createTransfer(input, idempotencyKey)
}

export async function dispatchTransfer(
  id: string,
  idempotencyKey: string,
  lines?: { skuId: string; quantity: number }[],
): Promise<ApiTransfer> {
  return getApiClient().dispatchTransfer(id, idempotencyKey, lines)
}

export async function receiveTransfer(
  id: string,
  lines: { skuId: string; accepted: number; damaged?: number }[],
  idempotencyKey: string,
): Promise<ApiTransfer> {
  return getApiClient().receiveTransfer(id, lines, idempotencyKey)
}

export async function resolveTransfer(
  id: string,
  reason: string,
  idempotencyKey: string,
  lines?: { skuId: string; quantity: number }[],
): Promise<ApiTransfer> {
  return getApiClient().resolveTransfer(id, reason, idempotencyKey, lines)
}

export async function cancelTransfer(id: string): Promise<ApiTransfer> {
  return getApiClient().cancelTransfer(id)
}
