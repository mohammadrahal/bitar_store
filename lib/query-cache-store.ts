/**
 * One IndexedDB slot per signed-in user, holding the dehydrated TanStack Query
 * cache so the app has something to draw when it opens without a network.
 *
 * Not `localStorage`, for the reason set out in lib/blob-store.ts: that is a
 * ~5 MB quota for the whole origin, shared with the session, the preferences
 * and the device-local records. A full catalog snapshot plus a few branches of
 * balances runs to megabytes, and the write that overflows the quota throws —
 * taking the keys next to it down with it.
 *
 * Every call fails soft. A blocked, full or disabled store must never stop the
 * app from starting: the worst outcome is the screens fetching from the server
 * the way they did before any of this existed.
 */

const DB_NAME = 'bitar-query-cache'
const DB_VERSION = 1
const STORE = 'snapshots'

export interface CacheSnapshot {
  /** Bumped when the dehydrated shape changes, so old snapshots are ignored. */
  version: number
  /** When the snapshot was written, as epoch ms. */
  savedAt: number
  /** The output of `dehydrate(queryClient)`. */
  state: unknown
}

function available(): boolean {
  return typeof indexedDB !== 'undefined'
}

function open(): Promise<IDBDatabase | null> {
  if (!available()) return Promise.resolve(null)
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      /* Firefox in a private window throws here rather than erroring. */
      resolve(null)
      return
    }
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    /* Another tab holding an old version open. Rather than hang, give up. */
    request.onblocked = () => resolve(null)
  })
}

function withStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest,
  fallback: T,
): Promise<T> {
  return open().then((db) => {
    if (!db) return fallback
    return new Promise<T>((resolve) => {
      let request: IDBRequest
      try {
        request = work(db.transaction(STORE, mode).objectStore(STORE))
      } catch {
        db.close()
        resolve(fallback)
        return
      }
      request.onsuccess = () => {
        resolve(request.result as T)
        db.close()
      }
      request.onerror = () => {
        resolve(fallback)
        db.close()
      }
    })
  })
}

export async function readSnapshot(scope: string): Promise<CacheSnapshot | null> {
  const row = await withStore<CacheSnapshot | undefined>('readonly', (store) => store.get(scope), undefined)
  if (!row || typeof row !== 'object' || typeof row.savedAt !== 'number') return null
  return row
}

export async function writeSnapshot(scope: string, snapshot: CacheSnapshot): Promise<boolean> {
  const result = await withStore<IDBValidKey | null>('readwrite', (store) => store.put(snapshot, scope), null)
  return result !== null
}

export async function deleteSnapshot(scope: string): Promise<void> {
  await withStore<undefined>('readwrite', (store) => store.delete(scope), undefined)
}

/** Drops every user's snapshot. Used on sign-out and on a version bump. */
export async function clearSnapshots(): Promise<void> {
  await withStore<undefined>('readwrite', (store) => store.clear(), undefined)
}
