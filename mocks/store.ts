import type { Branch, Product, Variant } from '@/types'

/*
 * The catalog mirror. Branches, styles and SKUs come from the API and are kept
 * here so a picker, a table or a stock row can name a SKU without a call per
 * keystroke. Nothing is invented: the store starts empty and only ever holds a
 * copy of what the server returned.
 */

const STORAGE_KEY = 'bitar-fashion:catalog-db:v11'
const LEGACY_KEYS = [
  'bitar-fashion:mock-db:v1',
  'bitar-fashion:catalog-db:v1',
  'bitar-fashion:catalog-db:v4',
  'bitar-fashion:catalog-db:v5',
  'bitar-fashion:catalog-db:v6',
  'bitar-fashion:catalog-db:v7',
  'bitar-fashion:catalog-db:v8',
  'bitar-fashion:catalog-db:v9',
  'bitar-fashion:catalog-db:v10',
]
/** Bump, together with STORAGE_KEY, to discard any previously persisted payload. */
const VERSION = 11

export interface MockDb {
  version: number
  branches: Branch[]
  /** The warehouse among the branches, as `GET /branches` marks it. */
  warehouseId: string | null
  /** Mirror of the API catalog: styles as products, SKUs as variants. */
  products: Product[]
  variants: Variant[]
  /** True once the whole API catalog has been mirrored at least once. */
  catalogSynced: boolean
}

let db: MockDb | null = null

function createEmptyDb(): MockDb {
  return {
    version: VERSION,
    branches: [],
    warehouseId: null,
    products: [],
    variants: [],
    catalogSynced: false,
  }
}

function isCurrentDb(value: unknown): value is MockDb {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<MockDb>
  return (
    candidate.version === VERSION &&
    Array.isArray(candidate.branches) &&
    Array.isArray(candidate.products) &&
    Array.isArray(candidate.variants)
  )
}

function persist() {
  if (typeof window === 'undefined' || !db) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // Private browsing or quota: in-memory copy still works for this session.
  }
}

function load(): MockDb {
  if (db) return db
  if (typeof window !== 'undefined') {
    for (const key of LEGACY_KEYS) window.localStorage.removeItem(key)
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : null
      if (isCurrentDb(parsed)) {
        db = parsed
        return db
      }
    } catch {
      // Unreadable payload: start empty.
    }
  }
  db = createEmptyDb()
  persist()
  return db
}

/** Read-only copy so callers cannot mutate stored records in place. */
export function readDb(): MockDb {
  return structuredClone(load())
}

export function writeDb<T>(change: (db: MockDb) => T): T {
  const result = change(load())
  persist()
  return result
}

/** Replaces the mirror with a copy that was changed and checked as a whole. */
export function commitDb(next: MockDb) {
  db = next
  persist()
}

export function resetDb() {
  db = createEmptyDb()
  persist()
}

/** A variant leaves pickers when its SKU or its whole model is inactive. */
export function isRetired(db: MockDb, variant: Variant): boolean {
  if (variant.archived) return true
  return db.products.find((product) => product.id === variant.productId)?.archived ?? true
}
