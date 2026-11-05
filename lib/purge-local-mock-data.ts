import { clearAllBlobs } from '@/lib/blob-store'
import { resetDb } from '@/mocks/store'
import { clearTodayBranchSalesCache } from '@/services/today-branch-sales.service'

/** Bump when a new purge pass should run for every browser. */
const PURGE_MARKER = 'bitar:local-mock-purged:v2'

/** Device-local records from before the API-backed flows, or from old mock-db builds. */
const LOCAL_MOCK_KEYS = [
  'bitar-fashion:mock-db:v1',
  'bitar:pending-sales:v1',
  'bitar:pending-invoices:v1',
  'bitar:stock-receipts:v1',
  'bitar:wholesale-invoices:v1',
] as const

/**
 * Removes mock and legacy device-only business data. Keeps session, UI prefs,
 * exchange rate, catalog costs and user-access overlays.
 */
export async function purgeLocalMockData(): Promise<void> {
  if (typeof window === 'undefined') return
  for (const key of LOCAL_MOCK_KEYS) {
    window.localStorage.removeItem(key)
  }
  resetDb()
  clearTodayBranchSalesCache()
  await clearAllBlobs()
}

/** Runs {@link purgeLocalMockData} once per {@link PURGE_MARKER} version. */
export async function ensureLocalMockDataPurged(): Promise<void> {
  if (typeof window === 'undefined') return
  if (window.localStorage.getItem(PURGE_MARKER)) return
  await purgeLocalMockData()
  window.localStorage.setItem(PURGE_MARKER, '1')
}
