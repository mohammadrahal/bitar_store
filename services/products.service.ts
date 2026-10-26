import { delay, delayedFailure } from '@/lib/delay'
import { createId } from '@/lib/ids'
import type { ProductFilters } from '@/lib/query-keys'
import { buildEan13 } from '@/lib/barcode'
import { buildSku } from '@/lib/sku'
import { DEFAULT_LOW_STOCK_AT, readDb, writeDb, type MockDb } from '@/mocks/store'
import type { Product, ProductWithVariants, Variant, VariantOption } from '@/types'


export interface VariantInput {
  id?: string
  size: string
  color: string
}

export interface ProductInput {
  name: string
  category: string
  costPrice: number
  sellPrice: number
  variants: VariantInput[]
}

function attachVariants(product: Product, variants: Variant[]): ProductWithVariants {
  return { ...product, variants: variants.filter((variant) => variant.productId === product.id) }
}

export async function listProducts(filters: ProductFilters): Promise<ProductWithVariants[]> {
  const { products, variants } = readDb()
  const search = filters.search.trim().toLowerCase()

  const rows = products
    .map((product) => attachVariants(product, variants))
    .filter((product) => (filters.category ? product.category === filters.category : true))
    .filter(
      (product) =>
        !search ||
        product.name.toLowerCase().includes(search) ||
        product.category.toLowerCase().includes(search) ||
        product.variants.some(
          (variant) => variant.sku.toLowerCase().includes(search) || variant.barcode.includes(search),
        ),
    )
    .sort((a, b) => a.name.localeCompare(b.name))

  return delay(rows)
}

export async function listCategories(): Promise<string[]> {
  const categories = [...new Set(readDb().products.map((product) => product.category))]
  return delay(categories.sort((a, b) => a.localeCompare(b)))
}

export async function getProduct(productId: string): Promise<ProductWithVariants> {
  const { products, variants } = readDb()
  const product = products.find((candidate) => candidate.id === productId)
  if (!product) return delayedFailure(`Product "${productId}" no longer exists.`)
  return delay(attachVariants(product, variants))
}

function normalize(input: ProductInput) {
  return {
    name: input.name.trim(),
    category: input.category.trim(),
    costPrice: input.costPrice,
    sellPrice: input.sellPrice,
  }
}

function findByName(name: string, exceptId?: string) {
  return readDb().products.find(
    (product) => product.id !== exceptId && product.name.toLowerCase() === name.toLowerCase(),
  )
}

/** Guards the service boundary even though the form schema checks this too. */
function findDuplicateVariant(variants: VariantInput[]) {
  const seen = new Map<string, string>()
  for (const variant of variants) {
    const size = variant.size.trim()
    const color = variant.color.trim()
    const key = `${size.toLowerCase()}|${color.toLowerCase()}`
    const first = seen.get(key)
    if (first) return first
    seen.set(key, `${size} / ${color}`)
  }
  return null
}

/** SKUs are derived from name, size and color, so near-identical styles need a suffix. */
function claimSku(base: string, taken: Set<string>) {
  if (!taken.has(base)) {
    taken.add(base)
    return base
  }
  let suffix = 2
  while (taken.has(`${base}-${suffix}`)) suffix += 1
  const sku = `${base}-${suffix}`
  taken.add(sku)
  return sku
}

/** Minted once per variant and never reissued, so labels stay truthful. */
function claimBarcode(db: MockDb): string {
  const used = new Set(db.variants.map((variant) => variant.barcode))
  while (used.has(buildEan13(db.barcodeSeq))) db.barcodeSeq += 1
  const barcode = buildEan13(db.barcodeSeq)
  db.barcodeSeq += 1
  return barcode
}

function addVariant(
  db: MockDb,
  productId: string,
  productName: string,
  input: VariantInput,
  taken: Set<string>,
): Variant {
  const size = input.size.trim()
  const color = input.color.trim()
  const variant: Variant = {
    id: createId('vr'),
    productId,
    sku: claimSku(buildSku(productName, size, color), taken),
    barcode: claimBarcode(db),
    size,
    color,
  }
  db.variants.push(variant)
  for (const branch of db.branches) {
    db.stock.push({ variantId: variant.id, branchId: branch.id, quantity: 0, lowStockAt: DEFAULT_LOW_STOCK_AT })
  }
  return variant
}

export async function createProduct(input: ProductInput): Promise<ProductWithVariants> {
  const fields = normalize(input)
  const clash = findByName(fields.name)
  if (clash) return delayedFailure(`A product named "${clash.name}" already exists.`)

  const duplicate = findDuplicateVariant(input.variants)
  if (duplicate) return delayedFailure(`The variant ${duplicate} is listed twice.`)

  const result = writeDb((db) => {
    const product: Product = { id: createId('pr'), ...fields, createdAt: new Date().toISOString() }
    db.products.push(product)
    const taken = new Set(db.variants.map((variant) => variant.sku))
    const created = input.variants.map((variant) => addVariant(db, product.id, product.name, variant, taken))
    return { ...product, variants: created.map((variant) => ({ ...variant })) }
  })

  return delay(result)
}

export async function updateProduct(productId: string, input: ProductInput): Promise<ProductWithVariants> {
  const fields = normalize(input)
  const clash = findByName(fields.name, productId)
  if (clash) return delayedFailure(`A product named "${clash.name}" already exists.`)

  const duplicate = findDuplicateVariant(input.variants)
  if (duplicate) return delayedFailure(`The variant ${duplicate} is listed twice.`)

  const result = writeDb((db) => {
    const product = db.products.find((candidate) => candidate.id === productId)
    if (!product) return null
    Object.assign(product, fields)

    // Variants dropped in the form take their stock records with them.
    const keptIds = new Set(input.variants.map((variant) => variant.id).filter(Boolean))
    const removedIds = db.variants
      .filter((variant) => variant.productId === productId && !keptIds.has(variant.id))
      .map((variant) => variant.id)
    db.variants = db.variants.filter((variant) => !removedIds.includes(variant.id))
    db.stock = db.stock.filter((level) => !removedIds.includes(level.variantId))

    const taken = new Set(
      db.variants.filter((variant) => variant.productId !== productId).map((variant) => variant.sku),
    )
    const saved = input.variants.map((incoming) => {
      const current = incoming.id ? db.variants.find((variant) => variant.id === incoming.id) : undefined
      if (!current) return addVariant(db, productId, product.name, incoming, taken)
      const size = incoming.size.trim()
      const color = incoming.color.trim()
      /* The SKU is re-derived when the name, size or colour changes; the
         barcode is not, because it is already printed on stock. */
      Object.assign(current, { size, color, sku: claimSku(buildSku(product.name, size, color), taken) })
      return current
    })

    return { ...product, variants: saved.map((variant) => ({ ...variant })) }
  })

  if (!result) return delayedFailure(`Product "${productId}" no longer exists.`)
  return delay(result)
}

export async function deleteProduct(productId: string): Promise<void> {
  const product = readDb().products.find((candidate) => candidate.id === productId)
  if (!product) return delayedFailure(`Product "${productId}" no longer exists.`)

  writeDb((db) => {
    const variantIds = db.variants.filter((variant) => variant.productId === productId).map((variant) => variant.id)
    db.products = db.products.filter((candidate) => candidate.id !== productId)
    db.variants = db.variants.filter((variant) => variant.productId !== productId)
    db.stock = db.stock.filter((level) => !variantIds.includes(level.variantId))
  })
  return delay(undefined)
}

/** Catalog variants for the invoice line picker, matched on SKU, name or category. */
export async function searchVariants(search: string, limit = 10): Promise<VariantOption[]> {
  const { products, variants } = readDb()
  const term = search.trim().toLowerCase()

  const options = variants.flatMap<VariantOption>((variant) => {
    const product = products.find((candidate) => candidate.id === variant.productId)
    if (!product) return []
    const haystack = `${variant.sku} ${variant.barcode} ${product.name} ${product.category} ${variant.size} ${variant.color}`.toLowerCase()
    if (term && !haystack.includes(term)) return []
    return [
      {
        variantId: variant.id,
        sku: variant.sku,
        barcode: variant.barcode,
        productId: product.id,
        productName: product.name,
        size: variant.size,
        color: variant.color,
        costPrice: product.costPrice,
        sellPrice: product.sellPrice,
      },
    ]
  })

  options.sort((a, b) => a.productName.localeCompare(b.productName) || a.sku.localeCompare(b.sku))
  return delay(options.slice(0, limit))
}
