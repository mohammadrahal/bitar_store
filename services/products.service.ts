import { getApiClient } from '@/lib/api'
import { DEFAULT_CURRENCY, priceText } from '@/lib/api/map-catalog'
import type { ProductFilters } from '@/lib/query-keys'
import { buildSku, buildVariantCode, formatModelCode } from '@/lib/sku'
import { readDb } from '@/mocks/store'
import { mintBarcode } from '@/services/barcodes.service'
import { refreshStyle, syncCatalog } from '@/services/catalog-sync.service'
import { postOpeningStock } from '@/services/opening-stock.service'
import type { Product, ProductWithVariants, Variant } from '@/types'

export interface ProductDetailsInput {
  name: string
  category: string
  /** On edit, a changed price is applied to every active SKU of the model. */
  sellPrice: number
}

export interface Combination {
  color: string
  size: string
  /** When set, this SKU is created at this price instead of the model's default. */
  sellPrice?: number
}

export interface ProductInput extends ProductDetailsInput {
  /** Style code; blank takes the next free MD code. */
  code: string
  variants: Combination[]
  /** Units counted in at one location as the model is saved, by `color|size`. */
  opening?: { branchId: string; quantities: Record<string, number> }
}

const comboKeyOf = (combo: Combination) => `${combo.color}|${combo.size}`

export interface CreatedProduct {
  product: ProductWithVariants
  /** Combinations the API refused, with its reason. The model itself was saved. */
  skipped: string[]
  /** Variants that were saved but did not get a barcode; one can be generated from the model page. */
  unbarcoded: string[]
  /** Units counted in with the model. */
  opened?: { lines: number; branchId: string }
  /** Why the opening count did not post, when the model itself was saved. */
  openingFailed?: string
}

function attachVariants(product: Product, variants: Variant[]): ProductWithVariants {
  return { ...product, variants: variants.filter((variant) => variant.productId === product.id) }
}

function matches(product: ProductWithVariants, search: string) {
  return (
    !search ||
    product.name.toLowerCase().includes(search) ||
    product.code.toLowerCase().includes(search) ||
    product.category.toLowerCase().includes(search) ||
    product.variants.some((variant) => variant.sku.toLowerCase().includes(search) || variant.barcode.includes(search))
  )
}

export async function listProducts(filters: ProductFilters): Promise<ProductWithVariants[]> {
  await syncCatalog()
  const { products, variants } = readDb()
  const search = filters.search.trim().toLowerCase()
  const show = filters.show ?? 'active'
  return products
    .filter((product) => show === 'all' || product.archived === (show === 'archived'))
    .filter((product) => (filters.category ? product.category === filters.category : true))
    .map((product) => attachVariants(product, variants))
    .filter((product) => matches(product, search))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function listCategories(): Promise<string[]> {
  const categories = [...new Set(readDb().products.map((product) => product.category))]
  return categories.sort((a, b) => a.localeCompare(b))
}

export async function getProduct(productId: string): Promise<ProductWithVariants> {
  await refreshStyle(productId)
  const { products, variants } = readDb()
  const product = products.find((candidate) => candidate.id === productId)
  if (!product) throw new Error('Product not found')
  return attachVariants(product, variants)
}

/** One past the highest MD code in the catalog. */
function nextStyleCode(products: Product[]): string {
  const numbers = products.map((product) => /^MD(\d+)$/.exec(product.code)?.[1]).filter(Boolean).map(Number)
  return formatModelCode(numbers.length ? Math.max(...numbers) + 1 : 1)
}

const reason = (error: unknown) => (error instanceof Error ? error.message : 'refused')

/**
 * Creates SKUs one at a time so each refusal can be reported against its
 * combination, and gives every new SKU its own barcode.
 */
async function createSkus(
  styleId: string,
  styleCode: string,
  combos: Combination[],
  price: number,
): Promise<Omit<CreatedProduct, 'product'> & { created: Map<string, string> }> {
  const api = getApiClient()
  const taken = new Set(readDb().variants.map((variant) => variant.sku))
  const skipped: string[] = []
  const unbarcoded: string[] = []
  /** `color|size` -> new SKU id. */
  const created = new Map<string, string>()
  for (const combo of combos) {
    const base = buildSku(styleCode, buildVariantCode(combo.color, combo.size))
    let skuCode = base
    for (let suffix = 2; taken.has(skuCode); suffix += 1) skuCode = `${base}-${suffix}`
    taken.add(skuCode)
    const label = `${combo.color} / ${combo.size}`
    let skuId: string
    try {
      const sku = await api.createSku({
        styleId,
        skuCode,
        size: combo.size.trim(),
        color: combo.color.trim(),
        standardPrice: priceText(combo.sellPrice ?? price),
        currency: DEFAULT_CURRENCY,
      })
      skuId = sku.id
      created.set(comboKeyOf(combo), sku.id)
    } catch (error) {
      skipped.push(`${label}: ${reason(error)}`)
      continue
    }
    try {
      await mintBarcode(skuId)
    } catch (error) {
      unbarcoded.push(`${label}: ${reason(error)}`)
    }
  }
  return { skipped, unbarcoded, created }
}

export async function createProduct(input: ProductInput): Promise<CreatedProduct> {
  if (input.variants.length === 0) throw new Error('Tick at least one color and size combination.')
  await syncCatalog()
  const code = input.code.trim().toUpperCase() || nextStyleCode(readDb().products)
  const style = await getApiClient().createStyle({ code, name: input.name.trim(), category: input.category.trim() })
  const outcome = await createSkus(style.id, style.code, input.variants, input.sellPrice)
  await refreshStyle(style.id)
  const opening = await openCountedUnits(input, outcome.created)
  return { product: await getProduct(style.id), ...outcome, ...opening }
}

/**
 * Posts the counted units against the SKUs that were just created. The model is
 * already saved by this point, so a refusal is reported beside it rather than
 * thrown: the catalog record must not be lost over a count.
 */
async function openCountedUnits(
  input: ProductInput,
  created: Map<string, string>,
): Promise<Pick<CreatedProduct, 'opened' | 'openingFailed'>> {
  const branchId = input.opening?.branchId
  if (!branchId) return {}

  const quantities: Record<string, number> = {}
  for (const [combo, quantity] of Object.entries(input.opening?.quantities ?? {})) {
    const skuId = created.get(combo)
    if (skuId && quantity > 0) quantities[skuId] = Math.floor(quantity)
  }
  const lines = Object.keys(quantities).length
  if (lines === 0) return {}

  try {
    await postOpeningStock({ branchId, quantities })
    return { opened: { lines, branchId } }
  } catch (error) {
    return { openingFailed: error instanceof Error ? error.message : 'The opening count did not post.' }
  }
}

/** Name and category go to the API; a new sell price re-prices every active SKU. */
export async function updateProduct(productId: string, input: ProductDetailsInput): Promise<ProductWithVariants> {
  const api = getApiClient()
  const current = await getProduct(productId)
  await api.updateStyle(productId, { name: input.name.trim(), category: input.category.trim() })
  if (input.sellPrice !== current.sellPrice) {
    const price = priceText(input.sellPrice)
    const live = current.variants.filter((variant) => !variant.archived && variant.sellPrice !== input.sellPrice)
    await Promise.all(live.map((variant) => api.setSkuPrice(variant.id, price)))
  }
  return getProduct(productId)
}

export async function addVariants(productId: string, combos: Combination[]): Promise<CreatedProduct> {
  if (combos.length === 0) throw new Error('Pick at least one new combination.')
  const product = await getProduct(productId)
  const { created, ...outcome } = await createSkus(product.id, product.code, combos, product.sellPrice)
  if (outcome.skipped.length === combos.length) throw new Error(`No variants were added. ${outcome.skipped[0]}`)
  await refreshStyle(productId)
  return { product: await getProduct(productId), ...outcome }
}

export { searchVariants } from '@/services/variant-search.service'
