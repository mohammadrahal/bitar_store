import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
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
}
