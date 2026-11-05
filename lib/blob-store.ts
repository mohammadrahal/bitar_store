/**
 * A small IndexedDB store for binary files the API cannot hold.
 *
 * Why not `localStorage`, which the rest of the device-local records use: that
 * is a **~5 MB quota for the whole origin**, shared with every other key the app
 * keeps there. One photograph of an invoice would fill most of it and the second
 * would throw, taking the receipts index down with it. IndexedDB is measured in
 * hundreds of megabytes, stores a `Blob` without base64 inflating it by a third,
 * and is the right tool for a file.
 *
 * Every call fails soft and returns null or false. A blocked or full store must
 * never stop a receipt being posted: the stock and the audit note are the part
 * that matters, the photograph is the nice-to-have.
 */

const DB_NAME = 'bitar-files'
const DB_VERSION = 1
const STORE = 'blobs'

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

export async function putBlob(key: string, blob: Blob): Promise<boolean> {
  const result = await withStore<IDBValidKey | null>('readwrite', (store) => store.put(blob, key), null)
  return result !== null
}

export async function getBlob(key: string): Promise<Blob | null> {
  const result = await withStore<Blob | undefined>('readonly', (store) => store.get(key), undefined)
  return result instanceof Blob ? result : null
}

export async function deleteBlob(key: string): Promise<void> {
  await withStore<undefined>('readwrite', (store) => store.delete(key), undefined)
}

/** Drops every stored blob (legacy receipt photos, etc.). */
export async function clearAllBlobs(): Promise<void> {
  await withStore<undefined>('readwrite', (store) => store.clear(), undefined)
}

/**
 * How much room is left, when the browser will say.
 *
 * Used to warn before a photograph is accepted rather than after it is lost.
 * `null` means the browser does not expose it, which is not the same as full.
 */
export async function remainingBytes(): Promise<number | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null
  try {
    const { quota, usage } = await navigator.storage.estimate()
    if (quota === undefined || usage === undefined) return null
    return Math.max(0, quota - usage)
  } catch {
    return null
  }
}
