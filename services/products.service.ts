import { getApiClient } from '@/lib/api'
import { DEFAULT_CURRENCY, priceText } from '@/lib/api/map-catalog'
import type { ProductFilters } from '@/lib/query-keys'
import { buildSku, buildVariantCode, formatModelCode } from '@/lib/sku'
import { setLocalProductFields } from '@/mocks/mirror'
import { readDb } from '@/mocks/store'
import { mintBarcode } from '@/services/barcodes.service'
import { refreshStyle, syncCatalog } from '@/services/catalog-sync.service'
import { branchesCarrying, placeOpeningStock } from '@/services/opening-stock.service'
import { callerSeesCosts } from '@/services/mock-ledger'
import type { Product, ProductDetails, ProductWithVariants, Variant } from '@/types'

export interface ProductDetailsInput {
  name: string
  category: string
  /** Ignored for callers who cannot see costs, so an edit never wipes it. */
  costPrice: number
  /** On edit, a changed price is applied to every active SKU of the model. */
  sellPrice: number
  details?: ProductDetails
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
  /** Where the model is stocked, with opening units keyed by `color|size`. */
  branches: { branchId: string; quantities: Record<string, number> }[]
}

const comboKeyOf = (combo: Combination) => `${combo.color}|${combo.size}`

export interface CreatedProduct {
  product: ProductWithVariants
  /** Combinations the API refused, with its reason. The model itself was saved. */
  skipped: string[]
  /** Variants that were saved but did not get a barcode; one can be generated from the model page. */
  unbarcoded: string[]
}

/** Cost is not on the API; this device hides it from callers who may not see it. */
export function redactProduct(product: ProductWithVariants): ProductWithVariants {
  return callerSeesCosts() ? product : { ...product, costPrice: 0 }
}

function attachVariants(product: Product, variants: Variant[]): ProductWithVariants {
  return redactProduct({ ...product, variants: variants.filter((variant) => variant.productId === product.id) })
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

function localFields(input: ProductDetailsInput, current?: Product) {
  return {
    costPrice: callerSeesCosts() ? input.costPrice : (current?.costPrice ?? 0),
    details: input.details,
  }
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
  const { created, ...outcome } = await createSkus(style.id, style.code, input.variants, input.sellPrice)
  await refreshStyle(style.id)
  setLocalProductFields(style.id, localFields(input))
  placeOpeningStock(
    input.branches.map(({ branchId, quantities }) => ({
      branchId,
      quantities: Object.fromEntries([...created].map(([key, skuId]) => [skuId, quantities[key] ?? 0])),
    })),
  )
  return { product: await getProduct(style.id), ...outcome }
}

/** Name and category go to the API; a new sell price re-prices every active SKU. Cost and details stay here. */
export async function updateProduct(productId: string, input: ProductDetailsInput): Promise<ProductWithVariants> {
  const api = getApiClient()
  const current = await getProduct(productId)
  await api.updateStyle(productId, { name: input.name.trim(), category: input.category.trim() })
  if (input.sellPrice !== current.sellPrice) {
    const price = priceText(input.sellPrice)
    const live = current.variants.filter((variant) => !variant.archived && variant.sellPrice !== input.sellPrice)
    await Promise.all(live.map((variant) => api.setSkuPrice(variant.id, price)))
  }
  setLocalProductFields(productId, localFields(input, readDb().products.find((product) => product.id === productId)))
  return getProduct(productId)
}

export async function addVariants(productId: string, combos: Combination[]): Promise<CreatedProduct> {
  if (combos.length === 0) throw new Error('Pick at least one new combination.')
  const product = await getProduct(productId)
  const carriedAt = branchesCarrying(productId)
  const { created, ...outcome } = await createSkus(product.id, product.code, combos, product.sellPrice)
  if (outcome.skipped.length === combos.length) throw new Error(`No variants were added. ${outcome.skipped[0]}`)
  await refreshStyle(productId)
  const placed = Object.fromEntries([...created.values()].map((skuId) => [skuId, 0]))
  placeOpeningStock(carriedAt.map((branchId) => ({ branchId, quantities: placed })))
  return { product: await getProduct(productId), ...outcome }
}

export { searchVariants } from '@/services/variant-search.service'
