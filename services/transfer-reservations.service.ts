import { visibleScope } from '@/services/mock-ledger'
import { listTransfersPage } from '@/services/transfers.service'
import { ALL_BRANCHES, type BranchScope } from '@/types'

const PAGE = 200
const MAX_PAGES = 100

/** `${branchId}:${skuId}` → units promised on draft transfers leaving that branch. */
export type DraftReservedMap = Map<string, number>

let cached: { scopeKey: string; at: number; map: DraftReservedMap } | null = null
const CACHE_MS = 15_000

export function clearDraftReservedCache(): void {
  cached = null
}

function scopeKey(scope: BranchScope, branchIds: string[]): string {
  const resolved = visibleScope(scope)
  return `${resolved}:${[...branchIds].sort().join(',')}`
}

function addLine(map: DraftReservedMap, branchId: string, skuId: string, quantity: number) {
  if (quantity <= 0) return
  const key = `${branchId}:${skuId}`
  map.set(key, (map.get(key) ?? 0) + quantity)
}

async function scanDraftReservations(branchId: string | undefined): Promise<DraftReservedMap> {
  const map: DraftReservedMap = new Map()
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const offset = page * PAGE
    const { items, total } = await listTransfersPage({
      ...(branchId ? { branchId } : {}),
      status: 'draft',
      limit: PAGE,
      offset,
    })
    for (const transfer of items) {
      if (transfer.status !== 'draft') continue
      const fromId = transfer.from.id
      for (const line of transfer.lines) {
        addLine(map, fromId, line.sku.id, line.requested)
      }
    }
    if (items.length < PAGE || offset + items.length >= total) break
  }
  return map
}

/**
 * Draft transfers reserve requested quantities at the sending branch until they
 * are sent or cancelled. The stock API does not move buckets yet, so this is
 * computed from `GET /transfers?status=draft`.
 */
export async function draftReservedQuantities(
  scope: BranchScope,
  branchIdsInScope: string[],
): Promise<DraftReservedMap> {
  const key = scopeKey(scope, branchIdsInScope)
  if (cached?.scopeKey === key && Date.now() - cached.at < CACHE_MS) return cached.map

  const resolved = visibleScope(scope)
  const branchId = resolved === ALL_BRANCHES ? undefined : resolved
  const map = await scanDraftReservations(branchId)
  cached = { scopeKey: key, at: Date.now(), map: new Map(map) }
  return map
}

export function reservedAtBranch(map: DraftReservedMap, branchId: string, skuId: string): number {
  return map.get(`${branchId}:${skuId}`) ?? 0
}

export function reservedInScope(map: DraftReservedMap, branchIds: string[], skuId: string): number {
  let total = 0
  for (const branchId of branchIds) {
    total += reservedAtBranch(map, branchId, skuId)
  }
  return total
}
