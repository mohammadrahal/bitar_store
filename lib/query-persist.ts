import { dehydrate, hydrate, type DehydratedState, type QueryClient } from '@tanstack/react-query'
import { getApiBaseUrl } from '@/lib/api/client'
import { clearSnapshots, readSnapshot, writeSnapshot, type CacheSnapshot } from '@/lib/query-cache-store'

/** Bump when a service's return shape changes, to retire every saved snapshot. */
const PERSIST_VERSION = 1

/**
 * A snapshot older than this is dropped rather than shown. A week covers a
 * long weekend plus a closed Monday; beyond that the figures are misleading
 * enough that an empty screen is the more honest answer.
 */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Roughly how much we are willing to keep. IndexedDB would take far more, but
 * the snapshot is serialised and parsed on every save and on startup, and a
 * tablet reading 20 MB of JSON before first paint is worse than a short cache.
 */
const MAX_BYTES = 4_000_000

/**
 * Writes are collapsed over this window. Every save serialises the whole cache,
 * so this is a trade against a tablet's CPU rather than against correctness:
 * what is lost by waiting is at most the last few seconds of reads, and the
 * banner shows the age of what was saved either way.
 */
const THROTTLE_MS = 10_000

/**
 * Query keys not worth keeping between sessions.
 *
 * The search-as-you-type reads are here because they hold one entry per
 * keystroke: typing a style name leaves a dozen near-identical result sets
 * that nobody will ask for again, and together they dwarf the balances that
 * matter. The pending-sale drafts are already in localStorage, and reading
 * them back from a snapshot would show a parked cart that was since posted.
 */
const DO_NOT_PERSIST: readonly (readonly unknown[])[] = [
  ['products', 'variants'],
  ['stock', 'picker'],
  ['stock', 'sale-models'],
  ['stock', 'sale-models-at-branch'],
  ['sales', 'pending-sales'],
]

/**
 * The store holds whatever a previous build wrote, so the snapshot is checked
 * for shape before `hydrate` is handed it. Only the outer frame is verified:
 * an individual query that no longer parses is the version marker's job.
 */
function isDehydrated(state: unknown): state is DehydratedState {
  return typeof state === 'object' && state !== null && Array.isArray((state as DehydratedState).queries)
}

function isDenied(queryKey: readonly unknown[]): boolean {
  return DO_NOT_PERSIST.some((prefix) => prefix.every((part, index) => queryKey[index] === part))
}

/**
 * One slot per user *and* per API origin, so a snapshot taken against staging
 * can never be drawn in a production window, and signing in as someone with
 * narrower branch access never shows the previous user's figures.
 */
/** Scopes already read back this session, so a remount does not re-read them. */
const restored = new Set<string>()

/** One live subscription per scope, shared by every gate that asked for it. */
const persisters = new Map<string, { count: number; stop: () => void }>()

export function cacheScope(userId: string): string {
  return `${getApiBaseUrl()}::${userId}`
}

function snapshotFor(client: QueryClient): DehydratedState {
  return dehydrate(client, {
    shouldDehydrateMutation: () => false,
    shouldDehydrateQuery: (query) =>
      query.state.status === 'success' && query.state.data !== undefined && !isDenied(query.queryKey),
  })
}

/**
 * Builds the snapshot to store, dropping the least recently updated queries
 * until it fits the budget. Returns null when even a trimmed snapshot will
 * not, which takes a single enormous query.
 */
function trimToBudget(state: DehydratedState): CacheSnapshot | null {
  const queries = [...state.queries].sort((a, b) => a.state.dataUpdatedAt - b.state.dataUpdatedAt)
  let start = 0
  while (start < queries.length) {
    const candidate: CacheSnapshot = {
      version: PERSIST_VERSION,
      savedAt: Date.now(),
      state: { ...state, queries: queries.slice(start) },
    }
    if (JSON.stringify(candidate).length <= MAX_BYTES) return candidate
    /* Drop the oldest tenth and measure again, rather than one at a time. */
    start += Math.max(1, Math.ceil(queries.length / 10))
  }
  return null
}

/**
 * Fills the cache from the last snapshot for this user. Returns when the
 * attempt has finished, so callers can hold the first render until the screens
 * have something to draw instead of flashing empty states.
 *
 * Safe to call after queries have already started: `hydrate` keeps whichever
 * copy of a query was updated more recently, so a fetch that landed first is
 * never replaced by the snapshot behind it.
 */
export async function restoreQueryCache(client: QueryClient, scope: string): Promise<void> {
  if (restored.has(scope)) return
  restored.add(scope)
  let snapshot: CacheSnapshot | null = null
  try {
    snapshot = await readSnapshot(scope)
  } catch {
    return
  }
  if (!snapshot) return
  if (snapshot.version !== PERSIST_VERSION || Date.now() - snapshot.savedAt > MAX_AGE_MS) {
    void clearSnapshots()
    return
  }
  if (!isDehydrated(snapshot.state)) {
    void clearSnapshots()
    return
  }
  try {
    hydrate(client, snapshot.state)
  } catch {
    /* A snapshot this build cannot read is worse than none. */
    void clearSnapshots()
  }
}

/**
 * Saves the cache as it changes. Returns a function that stops saving and
 * flushes once more, so a sign-out does not lose the last few minutes.
 */
export function startPersistingQueryCache(client: QueryClient, scope: string): () => void {
  /* HydrationGate mounts twice on a cold start. once on `/`, then again under
     the dashboard layout, with the two overlapping while the redirect runs. One
     subscription is shared between them and torn down when the last one goes,
     so the snapshot is neither written twice nor left unwritten in between. */
  const live = persisters.get(scope)
  if (live) {
    live.count += 1
    return () => release(scope)
  }

  let timer: ReturnType<typeof setTimeout> | null = null
  let stopped = false

  const flush = () => {
    timer = null
    if (stopped) return
    const snapshot = trimToBudget(snapshotFor(client))
    if (snapshot) void writeSnapshot(scope, snapshot)
  }

  const schedule = () => {
    if (stopped || timer !== null) return
    timer = setTimeout(flush, THROTTLE_MS)
  }

  const unsubscribe = client.getQueryCache().subscribe((event) => {
    /* Only a change to the data is worth a write. Observers mounting and
       unmounting as the user walks between screens change nothing restorable. */
    if (event.type === 'added' || event.type === 'updated' || event.type === 'removed') schedule()
  })

  /* A tablet is usually put down rather than closed, so the pending write has
     to be started on the way out instead of waiting for a timer that will not
     fire. IndexedDB cannot be written synchronously, so a browser killed on the
     spot can still lose the last window. which costs staleness, not integrity. */
  const onHide = () => {
    if (document.visibilityState === 'hidden') flush()
  }
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', onHide)

  persisters.set(scope, {
    count: 1,
    stop: () => {
      unsubscribe()
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHide)
      if (timer !== null) clearTimeout(timer)
      flush()
      stopped = true
    },
  })

  return () => release(scope)
}

function release(scope: string) {
  const live = persisters.get(scope)
  if (!live) return
  live.count -= 1
  if (live.count > 0) return
  persisters.delete(scope)
  live.stop()
}

/** Drops every saved snapshot. Called when a session ends. */
export async function clearPersistedQueryCache(): Promise<void> {
  /* Also forget that these scopes were read, so signing back in on this tablet
     restores whatever is saved next rather than skipping the read. */
  restored.clear()
  await clearSnapshots()
}
