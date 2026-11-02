import { ApiError, getApiClient } from '@/lib/api'
import { mapApiSku } from '@/lib/api/map-catalog'
import { mirrorCatalog } from '@/mocks/mirror'
import { isRetired, readDb, type MockDb } from '@/mocks/store'
import type { VariantOption } from '@/types'

/** Something a scanner could have produced: one token, no spaces. */
const SCANNABLE = /^[\x21-\x7E]{4,64}$/

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function variantIdFromMirror(reference: string): string | null {
  const trimmed = reference.trim()
  if (!trimmed) return null
  const term = trimmed.toLowerCase()
  const db = readDb()
  const bySku = db.variants.find(
    (variant) => variant.sku.toLowerCase() === term || variant.sku === trimmed.toUpperCase(),
  )
  if (bySku) return bySku.id
  const byBarcode = db.variants.find((variant) => variant.barcode === trimmed)
  return byBarcode?.id ?? null
}

/**
 * API transfer lines need the sku uuid. Accepts uuid, sku code (e.g. MD000001-8B6-XS), or barcode.
 */
export async function resolveSkuReferenceToId(reference: string): Promise<string | null> {
  const trimmed = reference.trim()
  if (!trimmed) return null
  if (UUID.test(trimmed)) return trimmed

  const local = variantIdFromMirror(trimmed)
  if (local) return local

  if (!SCANNABLE.test(trimmed)) return null

  if (await lookUp(trimmed)) return variantIdFromMirror(trimmed)

  try {
    const sku = await getApiClient().lookupSku(trimmed)
    const scanned = sku.barcodes.find((barcode) => barcode.code === trimmed) ?? sku.barcodes[0]
    const variant = mapApiSku(sku, sku.style.code, scanned?.code ?? '')
    mirrorCatalog([], [variant])
    return variant.id
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

function optionsFrom(db: MockDb, term: string): VariantOption[] {
  return db.variants.flatMap<VariantOption>((variant) => {
    const product = db.products.find((candidate) => candidate.id === variant.productId)
    if (!product || isRetired(db, variant)) return []
    const haystack = `${variant.sku} ${variant.barcode} ${product.code} ${product.name} ${product.category} ${variant.size} ${variant.color}`.toLowerCase()
    if (term && !haystack.includes(term)) return []
    return [
      {
        variantId: variant.id,
        sku: variant.sku,
        barcode: variant.barcode,
        productId: product.id,
        productName: product.name,
        productCode: product.code,
        size: variant.size,
        color: variant.color,
        sellPrice: variant.sellPrice,
      },
    ]
  })
}

/**
 * Barcodes are only known locally once a SKU has been opened, so a scan that
 * matches nothing here asks the API, which knows every barcode.
 */
async function lookUp(code: string): Promise<boolean> {
  try {
    const sku = await getApiClient().lookupSku(code)
    const scanned = sku.barcodes.find((barcode) => barcode.code === code) ?? sku.barcodes[0]
    const variant = mapApiSku(sku, sku.style.code, scanned?.code ?? '')
    mirrorCatalog([], [variant])
    return true
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return false
    throw error
  }
}

/**
 * Catalog variants for pickers, matched on SKU, barcode, name or category.
 * Inactive SKUs and archived models never appear: they cannot be sold or
 * sent. With `branchId` each option carries what is available there.
 */
export async function searchVariants(search: string, limit = 10, branchId?: string): Promise<VariantOption[]> {
  const term = search.trim().toLowerCase()
  let sellable: Map<string, number> | null = null
  if (branchId) {
    const { branchSellableMap } = await import('@/services/stock-api.service')
    sellable = await branchSellableMap(branchId)
  }
  let options = optionsFrom(readDb(), term)
  if (options.length === 0 && SCANNABLE.test(search.trim()) && (await lookUp(search.trim()))) {
    options = optionsFrom(readDb(), term)
  }
  if (sellable) {
    options = options.map((option) => ({
      ...option,
      available: sellable!.get(option.variantId) ?? sellable!.get(option.sku) ?? 0,
    }))
  }
  options.sort((a, b) => a.productName.localeCompare(b.productName) || a.sku.localeCompare(b.sku))
  return options.slice(0, limit)
}
