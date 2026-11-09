import type { ApiPage } from '@/lib/api/client'
import { getApiClient } from '@/lib/api'
import type { ApiTransfer, CreateTransferInput, ListTransfersParams, TransferStatus } from '@/lib/api/types'
import { normalizeTransfer } from '@/services/transfer-normalize'

export type { ApiTransfer as Transfer, TransferStatus } from '@/lib/api/types'

const SCAN = 200
const MAX_SCAN_PAGES = 100

/**
 * Draft transfers are internal to the sender until dispatch. The API lists any
 * transfer that touches a branch, so the destination must not see drafts yet.
 */
export function isDraftVisibleAtBranch(transfer: ApiTransfer, branchId: string | undefined): boolean {
  if (!branchId || transfer.status !== 'draft') return true
  return transfer.from.id === branchId
}

function needsDraftScopeFilter(branchId: string, status: TransferStatus | ''): boolean {
  return Boolean(branchId) && (status === '' || status === 'draft')
}

export async function listTransfersPage(params: ListTransfersParams = {}) {
  const page = await getApiClient().listTransfersPage({ limit: 20, ...params })
  return { ...page, items: page.items.map(normalizeTransfer) }
}

/** Lists transfers for the UI, hiding inbound drafts at the receiving branch. */
export async function listTransfersPageForScope(
  branchId: string,
  status: TransferStatus | '',
  limit: number,
  offset: number,
): Promise<ApiPage<ApiTransfer>> {
  const apiStatus = status || undefined
  if (!needsDraftScopeFilter(branchId, status)) {
    return listTransfersPage({
      branchId: branchId || undefined,
      status: apiStatus,
      limit,
      offset,
    })
  }

  const matching: ApiTransfer[] = []
  let total = 0
  for (let page = 0; page < MAX_SCAN_PAGES; page += 1) {
    const chunk = await listTransfersPage({
      branchId: branchId || undefined,
      status: apiStatus,
      limit: SCAN,
      offset: page * SCAN,
    })
    for (const transfer of chunk.items) {
      if (!isDraftVisibleAtBranch(transfer, branchId || undefined)) continue
      if (total >= offset && matching.length < limit) matching.push(transfer)
      total += 1
    }
    if (chunk.items.length < SCAN || page * SCAN + chunk.items.length >= chunk.total) break
  }
  return { items: matching, total }
}

export async function getTransfer(id: string): Promise<ApiTransfer> {
  return normalizeTransfer(await getApiClient().getTransfer(id))
}

export async function createTransfer(input: CreateTransferInput, idempotencyKey: string): Promise<ApiTransfer> {
  return normalizeTransfer(await getApiClient().createTransfer(input, idempotencyKey))
}

export async function dispatchTransfer(
  id: string,
  idempotencyKey: string,
  lines?: { skuId: string; quantity: number }[],
): Promise<ApiTransfer> {
  return normalizeTransfer(await getApiClient().dispatchTransfer(id, idempotencyKey, lines))
}

/**
 * Count a shipment in. `note` is the inspector's remark on this pass, which the
 * server keeps on `transfer.receipts[]` rather than this browser keeping it.
 */
export async function receiveTransfer(
  id: string,
  lines: { skuId: string; accepted: number; damaged?: number }[],
  idempotencyKey: string,
  note?: string,
): Promise<ApiTransfer> {
  return normalizeTransfer(await getApiClient().receiveTransfer(id, lines, idempotencyKey, note))
}

/** The receiving passes, oldest first, for the report and the audit trail. */
export function receiptsOf(transfer: ApiTransfer) {
  return transfer.receipts ?? []
}

/** Every note left across the receiving passes, oldest first. */
export function receivingNotesOf(transfer: ApiTransfer) {
  return receiptsOf(transfer).filter((receipt) => Boolean(receipt.note?.trim()))
}

export async function acceptTransfer(
  id: string,
  lines: { skuId: string; quantity: number }[],
  idempotencyKey: string,
): Promise<ApiTransfer> {
  return normalizeTransfer(await getApiClient().acceptTransfer(id, lines, idempotencyKey))
}

export async function resolveTransfer(
  id: string,
  reason: string,
  idempotencyKey: string,
  lines?: { skuId: string; quantity: number }[],
): Promise<ApiTransfer> {
  return normalizeTransfer(await getApiClient().resolveTransfer(id, reason, idempotencyKey, lines))
}

export async function cancelTransfer(id: string): Promise<ApiTransfer> {
  return normalizeTransfer(await getApiClient().cancelTransfer(id))
}
