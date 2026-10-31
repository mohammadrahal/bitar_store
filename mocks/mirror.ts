import { writeDb, type MockDb } from '@/mocks/store'
import type { Branch, Product, Variant } from '@/types'

const WAREHOUSE_PATTERN = /warehouse|depot|\bwh\b|^wh[-_]?|main|hub/i

/**
 * `GET /branches` carries `kind`, so the warehouse is whatever the server says
 * it is. The name pattern stays as the fallback for a server that predates the
 * field, and for a network where nobody has marked one yet.
 */
function detectWarehouse(branches: Branch[]): string | null {
  const marked = branches.find((branch) => branch.kind === 'warehouse')
  if (marked) return marked.id
  const match = branches.find((branch) => WAREHOUSE_PATTERN.test(branch.name) || WAREHOUSE_PATTERN.test(branch.code ?? ''))
  return match?.id ?? null
}

/** Runs after either mirror, so the warehouse is known as soon as branches are. */
function settle(db: MockDb) {
  /* A location marked on the server outranks an older local pick. */
  const marked = db.branches.find((branch) => branch.kind === 'warehouse')
  if (marked) {
    db.warehouseId = marked.id
    return
  }
  if (!db.warehouseId) db.warehouseId = detectWarehouse(db.branches)
}

/**
 * Branches live on the API while stock lives here, so the store keeps a
 * mirror of them. Called whenever the branch list is fetched.
 *
 * Branches are upserted, never removed: a manager's API list contains only
 * their own branch, and dropping the rest would throw away other branches'
 * stock. Only a viewer of the whole network may `prune`.
 */
export function mirrorBranches(branches: Branch[], { prune = false } = {}): void {
  writeDb((db) => {
    if (branches.length === 0) {
      /* An empty API answer with prune means the network really has none — drop
         stale rows left from an older session. Scoped users never prune. */
      if (prune) {
        db.branches = []
        db.warehouseId = null
      }
      return
    }
    for (const incoming of branches) {
      const existing = db.branches.find((branch) => branch.id === incoming.id)
      if (existing) Object.assign(existing, incoming)
      else db.branches.push({ ...incoming })
    }

    if (prune) {
      const live = new Set(branches.map((branch) => branch.id))
      db.branches = db.branches.filter((branch) => live.has(branch.id))
      if (db.warehouseId && !live.has(db.warehouseId)) db.warehouseId = null
    }
    settle(db)
  })
}

function upsert<T extends { id: string }>(list: T[], incoming: T): T[] {
  const index = list.findIndex((item) => item.id === incoming.id)
  if (index === -1) return [...list, incoming]
  const next = [...list]
  next[index] = incoming
  return next
}

/**
 * Copies catalog records fetched from the API into the store, under their
 * real ids, so stock, transfers and documents can point at them. Records
 * replace what is stored, so callers carry over the cost, details and
 * barcode this device already knows (see `toCatalog`).
 *
 * `complete` marks a fetch of the whole catalog: anything missing from it is
 * gone on the server, so it is dropped together with its stock rows.
 */
export function mirrorCatalog(products: Product[], variants: Variant[], { complete = false } = {}): void {
  writeDb((db) => {
    for (const product of products) db.products = upsert(db.products, product)
    for (const variant of variants) db.variants = upsert(db.variants, variant)

    if (complete) {
      const liveProducts = new Set(products.map((product) => product.id))
      const liveVariants = new Set(variants.map((variant) => variant.id))
      db.products = db.products.filter((product) => liveProducts.has(product.id))
      db.variants = db.variants.filter((variant) => liveVariants.has(variant.id))
      db.catalogSynced = true
    }
    settle(db)
  })
}
