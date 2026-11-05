import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { clearMinimumsCache } from '@/services/reorder-minimums.service'
import { clearBranchStockPagesCache } from '@/services/stock-api.service'
import { clearTodayBranchSalesCache } from '@/services/today-branch-sales.service'
import { clearStockOverviewCache } from '@/services/warehouse.service'

/** React Query stock reads plus in-memory stock/sales snapshot caches. */
export function invalidateStockQueries(queryClient: QueryClient): void {
  clearStockOverviewCache()
  clearBranchStockPagesCache()
  clearTodayBranchSalesCache()
  void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all })
  /* The overview cards and the warehouse screens read the same balances through
     `/dashboard/overview`, `/stock/overview` and `/replenishment/suggestions`.
     Clearing the in-memory snapshots is not enough on its own: without these,
     React Query keeps serving the cached answer from before the movement. */
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.warehouse.all })
  /* `/reports/sales-summary` and `/reports/top-skus` are read per range, and a
     sale lands inside the range that is on screen. */
  void queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
}

/**
 * A minimum is not a balance, but every screen that judges a balance reads it:
 * `belowMinimum` in `/stock/overview`, the `/replenishment/suggestions` list and
 * the low-stock counts, which take theirs from the cached `/reorder-levels`
 * pages. Call this after `PUT`/`DELETE /reorder-levels`.
 */
export function invalidateMinimumQueries(queryClient: QueryClient): void {
  clearMinimumsCache()
  clearStockOverviewCache()
  void queryClient.invalidateQueries({ queryKey: queryKeys.warehouse.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
}
