import { DEFAULT_COLORS } from '@/mocks/default-colors'
import type {
  Branch,
  ColorOption,
  CountReport,
  Hold,
  Invoice,
  InvoiceLine,
  Product,
  StockEvent,
  StockLevel,
  Transfer,
  Variant,
} from '@/types'

const STORAGE_KEY = 'bitar-fashion:catalog-db:v6'
const LEGACY_KEYS = [
  'bitar-fashion:mock-db:v1',
  'bitar-fashion:catalog-db:v1',
  'bitar-fashion:catalog-db:v4',
  'bitar-fashion:catalog-db:v5',
]
/** Bump, together with STORAGE_KEY, to discard any previously persisted payload. */
const VERSION = 7
/** Version 6 gave every SKU an empty row at every branch; those are dropped on load. */
const UNCARRIED_ROWS_VERSION = 6

export interface MockDb {
  version: number
  branches: Branch[]
  /** The main warehouse among the branches, or null until one is known. */
  warehouseId: string | null
  /** Mirror of the API catalog: styles as products, SKUs as variants. */
  products: Product[]
  variants: Variant[]
  stock: StockLevel[]
  invoices: Invoice[]
  invoiceLines: InvoiceLine[]
  transfers: Transfer[]
  holds: Hold[]
  countReports: CountReport[]
  /** Transfer, reservation and hold changes; document lines are read from the invoices. */
  movements: StockEvent[]
  colors: ColorOption[]
  /** Results of stock-changing requests by Idempotency-Key, so a retry replays instead of repeating. */
  idempotency: Record<string, unknown>
  /** Next transfer number: TR-0043. */
  transferSeq: number
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
    stock: [],
    invoices: [],
    invoiceLines: [],
    transfers: [],
    holds: [],
    countReports: [],
    movements: [],
    colors: DEFAULT_COLORS.map((color) => ({ ...color })),
    idempotency: {},
    transferSeq: 1,
    catalogSynced: false,
  }
}

function migrate(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value
  const candidate = value as Partial<MockDb>
  if (candidate.version !== UNCARRIED_ROWS_VERSION || !Array.isArray(candidate.stock)) return value
  const stock = candidate.stock.filter(
    (level) =>
      level.quantity !== 0 || level.reserved !== 0 || level.onHold !== 0 || level.lowStockAt !== DEFAULT_LOW_STOCK_AT,
  )
  return { ...candidate, stock, version: VERSION }
}

function isCurrentDb(value: unknown): value is MockDb {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<MockDb>
  return (
    candidate.version === VERSION &&
    Array.isArray(candidate.branches) &&
    Array.isArray(candidate.products) &&
    Array.isArray(candidate.variants) &&
    Array.isArray(candidate.stock) &&
    Array.isArray(candidate.invoices) &&
    Array.isArray(candidate.transfers) &&
    Array.isArray(candidate.holds) &&
    Array.isArray(candidate.movements)
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
      const parsed = migrate(raw ? JSON.parse(raw) : null)
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

/** Replaces the store with a copy that was changed and checked as a whole, so a refused action leaves nothing half-applied. */
export function commitDb(next: MockDb) {
  db = next
  persist()
}

export function resetDb() {
  db = createEmptyDb()
  persist()
}

/** Quantity at or below which a variant counts as low stock. */
export const DEFAULT_LOW_STOCK_AT = 5

export function emptyLevel(variantId: string, branchId: string): StockLevel {
  return { variantId, branchId, quantity: 0, reserved: 0, onHold: 0, lowStockAt: DEFAULT_LOW_STOCK_AT }
}

/** A variant leaves pickers when its SKU or its whole model is inactive. */
export function isRetired(db: MockDb, variant: Variant): boolean {
  if (variant.archived) return true
  return db.products.find((product) => product.id === variant.productId)?.archived ?? true
}
