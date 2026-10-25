import type { Branch, Invoice, InvoiceLine, Product, StockLevel, Variant } from '@/types'

const STORAGE_KEY = 'bitar-fashion:catalog-db:v1'
/** Bump to discard any previously persisted catalog payload. */
const VERSION = 3

export interface MockDb {
  version: number
  branches: Branch[]
  products: Product[]
  variants: Variant[]
  stock: StockLevel[]
  invoices: Invoice[]
  invoiceLines: InvoiceLine[]
}

let db: MockDb | null = null

function createEmptyDb(): MockDb {
  return {
    version: VERSION,
    branches: [],
    products: [],
    variants: [],
    stock: [],
    invoices: [],
    invoiceLines: [],
  }
}

function isCatalogDb(value: unknown): value is MockDb {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<MockDb>
  return (
    candidate.version === VERSION &&
    Array.isArray(candidate.branches) &&
    Array.isArray(candidate.products) &&
    Array.isArray(candidate.variants) &&
    Array.isArray(candidate.stock) &&
    Array.isArray(candidate.invoices) &&
    Array.isArray(candidate.invoiceLines)
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
    localStorage.removeItem('bitar-fashion:mock-db:v1')
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      const parsed: unknown = raw ? JSON.parse(raw) : null
      if (isCatalogDb(parsed)) {
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

export function resetDb() {
  db = createEmptyDb()
  persist()
}
