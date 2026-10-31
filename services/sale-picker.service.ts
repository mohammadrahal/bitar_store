import { syncCatalog } from '@/services/catalog-sync.service'
import { branchSellableMapForStyle } from '@/services/stock-api.service'
import { isRetired, readDb } from '@/mocks/store'
import type { SaleModelOption, VariantOption } from '@/types'

/** Active styles for the till model row — from the API catalog, not a variant page slice. */
export async function listSaleModels(search: string, limit = 24): Promise<SaleModelOption[]> {
  await syncCatalog()
  const term = search.trim().toLowerCase()
  const db = readDb()

  return db.products
    .filter((product) => !product.archived)
    .filter((product) => {
      if (!term) return true
      const haystack = `${product.code} ${product.name} ${product.category}`.toLowerCase()
      if (haystack.includes(term)) return true
      return db.variants.some(
        (variant) =>
          variant.productId === product.id &&
          !isRetired(db, variant) &&
          `${variant.sku} ${variant.barcode} ${variant.color} ${variant.size}`.toLowerCase().includes(term),
      )
    })
    .filter((product) => db.variants.some((variant) => variant.productId === product.id && !isRetired(db, variant)))
    .sort((a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code))
    .slice(0, limit)
    .map((product) => ({
      productId: product.id,
      productCode: product.code,
      productName: product.name,
    }))
}

/** Every sellable SKU on a style at this branch, with sellable counts from the API. */
export async function listSaleVariants(branchId: string, productId: string): Promise<VariantOption[]> {
  await syncCatalog()
  const sellable = await branchSellableMapForStyle(branchId, productId)
  const db = readDb()
  const product = db.products.find((candidate) => candidate.id === productId)
  if (!product || product.archived) return []

  return db.variants
    .filter((variant) => variant.productId === productId && !isRetired(db, variant))
    .map((variant) => ({
      variantId: variant.id,
      sku: variant.sku,
      barcode: variant.barcode,
      productId: product.id,
      productName: product.name,
      productCode: product.code,
      size: variant.size,
      color: variant.color,
      sellPrice: variant.sellPrice,
      available:
        sellable.bySkuId.get(variant.id) ??
        sellable.bySkuCode.get(variant.sku) ??
        0,
    }))
    .sort((a, b) => a.color.localeCompare(b.color) || a.size.localeCompare(b.size) || a.sku.localeCompare(b.sku))
}
