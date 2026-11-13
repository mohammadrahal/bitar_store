import type { ApiSale } from '@/lib/api/types'
import { readDb } from '@/lib/catalog-cache/store'
import { visibleBranchIds, visibleScope } from '@/services/mock-ledger'
import { listSales } from '@/services/sales.service'
import { ALL_BRANCHES, type BranchScope } from '@/types'

const SALES_PAGE = 200
const CACHE_MS = 30_000

export interface BranchTodaySales {
  branchId: string
  businessDate: string
  sales: ApiSale[]
}

export interface TodaySalesSnapshot {
  businessDate: string
  byBranch: BranchTodaySales[]
}

function scopeCacheKey(scope: BranchScope): string {
  const resolved = visibleScope(scope)
  const db = readDb()
  const visible = [...visibleBranchIds(db)].sort()
  const branchIds =
    resolved === ALL_BRANCHES
      ? visible
      : visible.filter((id) => id === resolved)
  return `${resolved}:${branchIds.join(',')}`
}

let cached: { key: string; at: number; data: TodaySalesSnapshot } | null = null
const inflight = new Map<string, Promise<TodaySalesSnapshot>>()

export function clearTodayBranchSalesCache(): void {
  cached = null
  inflight.clear()
}

/** Today's completed sales per branch in scope. shared by dashboard ops and charts. */
export async function fetchTodayBranchSales(scope: BranchScope): Promise<TodaySalesSnapshot> {
  const key = scopeCacheKey(scope)
  if (cached?.key === key && Date.now() - cached.at < CACHE_MS) return cached.data

  let pending = inflight.get(key)
  if (!pending) {
    pending = loadTodayBranchSales(scope)
      .then((data) => {
        cached = { key, at: Date.now(), data }
        return data
      })
      /* Released whether the fetch resolved or threw. A rejected promise left
         in the map is handed to every later caller, so one failed `GET /sales`
         would keep the dashboard on the same error until a page reload. */
      .finally(() => {
        inflight.delete(key)
      })
    inflight.set(key, pending)
  }
  return pending
}

async function loadTodayBranchSales(scope: BranchScope): Promise<TodaySalesSnapshot> {
  const db = readDb()
  const resolved = visibleScope(scope)
  const visible = new Set(visibleBranchIds(db))
  const branches = db.branches.filter(
    (branch) => visible.has(branch.id) && (resolved === ALL_BRANCHES || branch.id === resolved),
  )

  const byBranch = await Promise.all(
    branches.map(async (branch) => {
      const result = await listSales({ branchId: branch.id, limit: SALES_PAGE })
      return { branchId: branch.id, businessDate: result.businessDate, sales: result.sales }
    }),
  )

  const businessDate = byBranch.find((row) => row.businessDate)?.businessDate ?? ''
  return { businessDate, byBranch }
}
