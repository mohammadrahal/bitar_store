import { buildEan13 } from '@/lib/barcode'
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
  /** Next in-store barcode sequence. Only ever counts up, so a deleted
      variant's barcode is never handed to a different item. */
  barcodeSeq: number
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
    barcodeSeq: 1,
  }
}

/**
 * Brings a payload stored before barcodes existed up to date instead of
 * discarding the catalog: every variant without one is minted a code, and the
 * sequence continues past whatever was handed out.
 */
function migrate(stored: MockDb): MockDb {
  let sequence = stored.barcodeSeq ?? 1
  let changed = stored.barcodeSeq === undefined

  for (const variant of stored.variants) {
    if (variant.barcode) continue
    variant.barcode = buildEan13(sequence)
    sequence += 1
    changed = true
  }

  stored.barcodeSeq = sequence
  if (changed) persist()
  return stored
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
        return migrate(db)
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

/** Quantity at or below which a variant counts as low stock. */
export const DEFAULT_LOW_STOCK_AT = 5

/**
 * Branches live on the API while stock lives here, so the catalog keeps a
 * mirror of them. Without it `db.branches` stays empty and a new variant gets
 * no stock rows at all, which makes the product invisible to every per-branch
 * figure. Called whenever the branch list is fetched.
 *
 * Branches are upserted, never removed: a manager's API list contains only
 * their own branch, and dropping the rest would throw away other branches'
 * stock.
 */
export function mirrorBranches(branches: Branch[], { prune = false } = {}): void {
  if (branches.length === 0) return

  writeDb((db) => {
    for (const incoming of branches) {
      const existing = db.branches.find((branch) => branch.id === incoming.id)
      if (existing) Object.assign(existing, incoming)
      else db.branches.push({ ...incoming })
    }

    /* Only a viewer of the whole network proves a branch is gone, so only
       their fetch drops one. Otherwise a reseeded or deleted branch lingers
       and gets counted. Its stock goes with it: the branch no longer exists. */
    if (prune) {
      const live = new Set(branches.map((branch) => branch.id))
      db.branches = db.branches.filter((branch) => live.has(branch.id))
      db.stock = db.stock.filter((level) => live.has(level.branchId))
    }

    // Every variant needs a row in every known branch, even at zero, or it
    // cannot be counted, listed as out of stock, or sold.
    const rows = new Set(db.stock.map((level) => `${level.variantId}|${level.branchId}`))
    for (const variant of db.variants) {
      for (const branch of db.branches) {
        if (rows.has(`${variant.id}|${branch.id}`)) continue
        db.stock.push({
          variantId: variant.id,
          branchId: branch.id,
          quantity: 0,
          lowStockAt: DEFAULT_LOW_STOCK_AT,
        })
      }
    }
  })
}
