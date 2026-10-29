import { createId } from '@/lib/ids'
import { canViewCosts, isLocationScoped } from '@/lib/permissions'
import { isOpenTransfer, lineInTransit } from '@/lib/transfers'
import { DEFAULT_LOW_STOCK_AT, emptyLevel, type MockDb } from '@/mocks/store'
import { useUserStore } from '@/store/user-store'
import { ALL_BRANCHES, type BranchScope, type StockEvent, type StockLevel } from '@/types'

/*
 * Stock arithmetic over the mock store. When the API lands these figures come
 * back from the server, so nothing outside services/ should import this file.
 */

export function levelOf(db: MockDb, variantId: string, branchId: string): StockLevel | undefined {
  return db.stock.find((level) => level.variantId === variantId && level.branchId === branchId)
}

/** The row to write to, created at zero when the variant has never been here. */
export function ensureLevel(db: MockDb, variantId: string, branchId: string): StockLevel {
  const existing = levelOf(db, variantId, branchId)
  if (existing) return existing
  const created = emptyLevel(variantId, branchId)
  db.stock.push(created)
  return created
}

export function availableOf(level: Pick<StockLevel, 'quantity' | 'reserved' | 'onHold'> | undefined) {
  if (!level) return 0
  return Math.max(0, level.quantity - level.reserved - level.onHold)
}

/** Units dispatched towards each `variantId|branchId` and not received yet. */
export function inTransitMap(db: MockDb): Map<string, number> {
  const map = new Map<string, number>()
  for (const transfer of db.transfers) {
    if (!isOpenTransfer(transfer.status)) continue
    for (const line of transfer.lines) {
      const units = lineInTransit(line)
      if (units === 0) continue
      const key = `${line.variantId}|${transfer.toBranchId}`
      map.set(key, (map.get(key) ?? 0) + units)
    }
  }
  return map
}

export function thresholdOf(level: StockLevel | undefined) {
  return level?.lowStockAt ?? DEFAULT_LOW_STOCK_AT
}

export function branchNameOf(db: MockDb, branchId: string) {
  return db.branches.find((branch) => branch.id === branchId)?.name ?? 'Unknown location'
}

export function logMovement(db: MockDb, event: Omit<StockEvent, 'id' | 'at'> & { at?: string }) {
  db.movements.push({ id: createId('mv'), at: event.at ?? new Date().toISOString(), ...event })
}

/**
 * The scope a caller may actually read. Branch-scoped roles asking for every
 * location, or for someone else's, get their own branch instead.
 */
export function visibleScope(scope: BranchScope): BranchScope {
  const user = useUserStore.getState().user
  if (!user || !isLocationScoped(user)) return scope
  if (scope !== ALL_BRANCHES && user.branchIds.includes(scope)) return scope
  return user.branchId ?? '__none__'
}

export function visibleBranchIds(db: MockDb): string[] {
  const user = useUserStore.getState().user
  if (!user || !isLocationScoped(user)) return db.branches.map((branch) => branch.id)
  return db.branches.filter((branch) => user.branchIds.includes(branch.id)).map((branch) => branch.id)
}

/** Who is acting, for activity logs. The real API takes this from the token. */
export function actorName(): string {
  return useUserStore.getState().user?.name ?? 'System'
}

/** Cost fields are left out for anyone who may not see them, as the API will do. */
export function callerSeesCosts(): boolean {
  const user = useUserStore.getState().user
  return user ? canViewCosts(user) : false
}

/**
 * The stored result of a request already applied under this Idempotency-Key.
 * Checked before validation: a retry after success must replay, even though
 * the stock it moved would now fail the same checks.
 */
export function replayOf<T>(db: MockDb, key: string | undefined): T | undefined {
  if (!key || !(key in db.idempotency)) return undefined
  return db.idempotency[key] as T
}

export function remember<T>(db: MockDb, key: string | undefined, result: T): T {
  if (key) db.idempotency[key] = structuredClone(result)
  return result
}
