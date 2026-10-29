import { writeDb, type MockDb } from '@/mocks/store'
import type { Branch, Product, Variant } from '@/types'

const WAREHOUSE_PATTERN = /warehouse|depot|\bwh\b|^wh[-_]?|main|hub/i

/** Branches have no type on the API yet, so the warehouse is recognised by its name or code. */
function detectWarehouse(branches: Branch[]): string | null {
  const match = branches.find((branch) => WAREHOUSE_PATTERN.test(branch.name) || WAREHOUSE_PATTERN.test(branch.code ?? ''))
  return match?.id ?? null
}

/**
 * Runs after either mirror. Stock rows are deliberately not created here: a
 * SKU is carried only at the branches it was placed in, so a branch that never
 * stocked it does not list it as out of stock.
 */
function settle(db: MockDb) {
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
  if (branches.length === 0) return

  writeDb((db) => {
    for (const incoming of branches) {
      const existing = db.branches.find((branch) => branch.id === incoming.id)
      if (existing) Object.assign(existing, incoming)
      else db.branches.push({ ...incoming })
    }

    if (prune) {
      const live = new Set(branches.map((branch) => branch.id))
      db.branches = db.branches.filter((branch) => live.has(branch.id))
      db.stock = db.stock.filter((level) => live.has(level.branchId))
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
      db.stock = db.stock.filter((level) => liveVariants.has(level.variantId))
      db.catalogSynced = true
    }
    settle(db)
  })
}

/** Sets what only this device keeps for a model: its extra details. */
export function setLocalProductFields(productId: string, fields: Pick<Product, 'details'>): void {
  writeDb((db) => {
    const product = db.products.find((candidate) => candidate.id === productId)
    if (product) Object.assign(product, fields)
  })
}
