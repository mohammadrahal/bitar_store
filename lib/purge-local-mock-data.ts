import { clearAllBlobs } from '@/lib/blob-store'
import { clearPersistedQueryCache } from '@/lib/query-persist'
import { resetDb } from '@/mocks/store'
import { clearTodayBranchSalesCache } from '@/services/today-branch-sales.service'

/** Bump when a new purge pass should run for every browser. */
const PURGE_MARKER = 'bitar:local-mock-purged:v3'

/** Device-local records from before the API-backed flows, or from old mock-db builds. */
const LOCAL_MOCK_KEYS = [
  'bitar-fashion:mock-db:v1',
  'bitar:pending-sales:v1',
  'bitar:pending-invoices:v1',
  'bitar:stock-receipts:v1',
  /* The USD/LBP rate the app kept per device before `GET /settings` existed.
     The server holds it now, and a stale figure here would have been the one
     printed on a receipt. `bitar:settings:v1` replaces it and is a cache of the
     server's answer, so it is NOT purged: the receipt printer reads it
     synchronously and a cleared one prints no LBP line at all. */
  'bitar:exchange-rate:v1',
  /** Wholesale B2B drafts live here. user data; do not purge with mock teardown. */
] as const

/**
 * Removes mock and legacy device-only business data. Keeps session, UI prefs,
 * the settings cache, catalog costs and user-access overlays.
 */
export async function purgeLocalMockData(): Promise<void> {
  if (typeof window === 'undefined') return
  for (const key of LOCAL_MOCK_KEYS) {
    window.localStorage.removeItem(key)
  }
  resetDb()
  clearTodayBranchSalesCache()
  await clearAllBlobs()
  /* The saved query cache is this device holding one user’s figures. It goes
     with the session, so the next person at the till cannot read them. */
  await clearPersistedQueryCache()
}

/** Runs {@link purgeLocalMockData} once per {@link PURGE_MARKER} version. */
export async function ensureLocalMockDataPurged(): Promise<void> {
  if (typeof window === 'undefined') return
  if (window.localStorage.getItem(PURGE_MARKER)) return
  await purgeLocalMockData()
  window.localStorage.setItem(PURGE_MARKER, '1')
}
