import { getApiClient } from '@/lib/api'
import { placeOpeningStock } from '@/services/opening-stock.service'
import { isApiFeatureMissing, noteMissingApiFeature } from '@/lib/api/capabilities'
import { DEFAULT_CURRENCY, priceText } from '@/lib/api/map-catalog'
import type { ProductFilters } from '@/lib/query-keys'
import { buildSku, buildVariantCode, formatModelCode } from '@/lib/sku'
import { readDb } from '@/mocks/store'
import { mintBarcode } from '@/services/barcodes.service'
import { applyModelCosts, getSkuCost, getStyleCost, setSkuCost, setStyleCost } from '@/services/catalog-costs.service'
import { refreshStyle, syncCatalog } from '@/services/catalog-sync.service'
import { setSkuCost as saveCatalogCost } from '@/services/costs.service'
import { statusOf } from '@/lib/errors'

import type { Product, ProductWithVariants, Variant } from '@/types'

export interface ProductDetailsInput {
  name: string
  category: string
  /** Stored on this device until the API accepts cost on catalog. */
  unitCost: number
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
  /** Per-variant cost overrides keyed by `color|size`. */
  costs?: Record<string, number>
  /** Optional opening count at one branch after SKUs are created. */
  initialBranchId?: string
  openingQuantities?: Record<string, number>
}

const comboKeyOf = (combo: Combination) => `${combo.color}|${combo.size}`

interface SkuCreateOutcome {
  skipped: string[]
  unbarcoded: string[]
  created: Map<string, string>
}

export interface CreatedProduct {
  product: ProductWithVariants
  /** SKUs that received an opening count on create, when the form asked for it. */
  openingLines: number
  /** Combinations the API refused, with its reason. The model itself was saved. */
  skipped: string[]
  /** Variants that were saved but did not get a barcode; one can be generated from the model page. */
  unbarcoded: string[]

}

function withLocalCosts(product: Product, variants: Variant[]): ProductWithVariants {
  const styleCost = getStyleCost(product.id)
  const enriched = variants
    .filter((variant) => variant.productId === product.id)
    .map((variant) => ({
      ...variant,
      unitCost: getSkuCost(variant.id) ?? styleCost,
    }))
  return {
    ...product,
    unitCost: styleCost,
    variants: enriched,
  }
}

function attachVariants(product: Product, variants: Variant[]): ProductWithVariants {
  return withLocalCosts(product, variants)
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
  if (!readDb().catalogSynced) await syncCatalog()
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
  if (isApiFeatureMissing('categories')) {
    const names = [...new Set(readDb().products.map((product) => product.category).filter(Boolean))]
    return names.sort((a, b) => a.localeCompare(b))
  }
  try {
    const categories = await getApiClient().listCategories({ activeOnly: true })
    return categories.map((category) => category.name).sort((a, b) => a.localeCompare(b))
  } catch (error) {
    noteMissingApiFeature(error, 'categories')
    const names = [...new Set(readDb().products.map((product) => product.category).filter(Boolean))]
    return names.sort((a, b) => a.localeCompare(b))
  }
}

/** A product may only use a category that already exists and is active. */
async function ensureCategory(name: string): Promise<string> {
  const trimmed = name.trim()
  if (!trimmed) return trimmed
  const existing = (await getApiClient().listCategories()).find(
    (category) => category.name.toLowerCase() === trimmed.toLowerCase(),
  )
  if (!existing) throw new Error('This category does not exist: add it in Categories first')
  if (!existing.isActive) throw new Error('This category is inactive. Activate it in Categories first.')
  return existing.name
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
 * Sends unit costs to `PUT /costs/skus/:id`, which is what a supply (B2B)
 * invoice is priced from when the warehouse has no purchase average yet.
 * Zero means "not recorded" and is not sent. A 403 means this account may not
 * set costs, which is not an error for the product save.
 */
async function saveCatalogCosts(costs: [skuId: string, unitCost: number][]) {
  await Promise.all(
    costs
      .filter(([, unitCost]) => unitCost > 0)
      .map(async ([skuId, unitCost]) => {
        try {
          await saveCatalogCost(skuId, unitCost)
        } catch (error) {
          if (statusOf(error) !== 403) throw error
        }
      }),
  )
}

/**
 * Creates SKUs one at a time so each refusal can be reported against its
 * combination, and gives every new SKU its own barcode.
 */
async function createSkus(
  styleId: string,
  styleCode: string,
  combos: Combination[],
  price: number,
): Promise<SkuCreateOutcome> {
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
  const category = await ensureCategory(input.category)
  const style = await getApiClient().createStyle({ code, name: input.name.trim(), category })
  const outcome = await createSkus(style.id, style.code, input.variants, input.sellPrice)
  applyModelCosts(style.id, input.unitCost, outcome.created, input.costs ?? {})
  await saveCatalogCosts(
    [...outcome.created].map(([key, skuId]) => [skuId, input.costs?.[key] ?? input.unitCost]),
  )
  await refreshStyle(style.id)

  const branchId = input.initialBranchId?.trim()
  let openingLines = 0
  if (branchId && input.openingQuantities) {
    const quantities: Record<string, number> = {}
    for (const [key, skuId] of outcome.created) {
      const quantity = input.openingQuantities[key] ?? 0
      if (quantity > 0) quantities[skuId] = quantity
    }
    if (Object.keys(quantities).length > 0) {
      await placeOpeningStock([{ branchId, quantities }])
      openingLines = Object.keys(quantities).length
    }
  }

  return {
    product: await getProduct(style.id),
    openingLines,
    skipped: outcome.skipped,
    unbarcoded: outcome.unbarcoded,
  }
}

/** Name and category go to the API; a new sell price or unit cost applies to every active SKU. */
export async function updateProduct(productId: string, input: ProductDetailsInput): Promise<ProductWithVariants> {
  const api = getApiClient()
  const current = await getProduct(productId)
  const category = await ensureCategory(input.category)
  await api.updateStyle(productId, { name: input.name.trim(), category })
  setStyleCost(productId, input.unitCost)
  const live = current.variants.filter((variant) => !variant.archived)
  const costChanged = input.unitCost > 0 && input.unitCost !== current.unitCost
  if (costChanged) for (const variant of live) setSkuCost(variant.id, input.unitCost)
  /* Sent on every save, changed or not, so a cost kept only on this device
     before costs reached the API is carried over by saving the model once. */
  await saveCatalogCosts(
    live.map((variant) => [variant.id, costChanged ? input.unitCost : (variant.unitCost ?? 0)]),
  )
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
  if (product.unitCost !== undefined) {
    for (const skuId of created.values()) setSkuCost(skuId, product.unitCost)
    await saveCatalogCosts([...created.values()].map((skuId) => [skuId, product.unitCost!]))
  }
  await refreshStyle(productId)
  return {
    product: await getProduct(productId),
    openingLines: 0,
    skipped: outcome.skipped,
    unbarcoded: outcome.unbarcoded,
  }
}

export { searchVariants } from '@/services/variant-search.service'
