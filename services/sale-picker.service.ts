import { syncCatalog } from '@/services/catalog-sync.service'
import { branchSellableMapForStyle, listBranchStockFromApi } from '@/services/stock-api.service'
import { draftReservedQuantities, reservedAtBranch } from '@/services/transfer-reservations.service'
import { isRetired, readDb } from '@/lib/catalog-cache/store'
import type { SaleModelOption, VariantOption } from '@/types'

/**
 * What the till may actually sell at one branch: sellable, less the units
 * already promised on a transfer leaving it (BL-04 rule 21). `GET /stock`
 * knows nothing of our reservations, so offering its `sellable` figure sells
 * stock twice — once here and once when the transfer is dispatched.
 */
async function reservedAt(branchId: string) {
  const map = await draftReservedQuantities(branchId, [branchId])
  return (skuId: string) => reservedAtBranch(map, branchId, skuId)
}

function sellableLessReserved(sellable: number, reserved: number): number {
  return Math.max(0, sellable - reserved)
}

/** Active styles for the till model row. from the API catalog, not a variant page slice. */
export async function listSaleModels(search: string, limit = 24): Promise<SaleModelOption[]> {
  if (!readDb().catalogSynced) await syncCatalog()
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
      variantCount: db.variants.filter((variant) => variant.productId === product.id && !isRetired(db, variant)).length,
    }))
}

/** Every sellable SKU on a style at this branch, with sellable counts from the API. */
export async function listSaleVariants(branchId: string, productId: string): Promise<VariantOption[]> {
  if (!readDb().catalogSynced) await syncCatalog()
  const [sellable, reservedFor] = await Promise.all([
    branchSellableMapForStyle(branchId, productId),
    reservedAt(branchId),
  ])
  const db = readDb()
  const product = db.products.find((candidate) => candidate.id === productId)
  if (!product || product.archived) return []

  const resolveAvailable = (variant: (typeof db.variants)[number]) => {
    const byId = sellable.bySkuId.get(variant.id)
    if (byId !== undefined) return byId
    const byCode = sellable.bySkuCode.get(variant.sku)
    if (byCode !== undefined) return byCode
    /* Same style may be keyed by API style id while the mirror still holds an older product id. */
    for (const [skuId, qty] of sellable.bySkuId) {
      const mirrored = db.variants.find((row) => row.id === skuId)
      if (mirrored?.sku === variant.sku) return qty
    }
    return 0
  }

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
      available: sellableLessReserved(resolveAvailable(variant), reservedFor(variant.id)),
    }))
    .sort((a, b) => a.color.localeCompare(b.color) || a.size.localeCompare(b.size) || a.sku.localeCompare(b.sku))
}

/** Models that currently hold stock at one branch (`GET /stock`), not the whole catalog. */
export async function listSaleModelsAtBranch(
  branchId: string,
  search: string,
  limit = 500,
): Promise<SaleModelOption[]> {
  const rows = await listBranchStockFromApi(branchId, search)
  const db = readDb()
  const byProduct = new Map<string, SaleModelOption & { count: number }>()

  for (const row of rows) {
    const product = db.products.find((candidate) => candidate.id === row.productId)
    if (product?.archived) continue
    const existing = byProduct.get(row.productId)
    if (existing) {
      existing.count += 1
      existing.variantCount = existing.count
      continue
    }
    byProduct.set(row.productId, {
      productId: row.productId,
      productCode: product?.code ?? row.sku.split('-')[0] ?? '',
      productName: row.productName,
      variantCount: 1,
      count: 1,
    })
  }

  return [...byProduct.values()]
    .map(({ count: _count, ...option }) => option)
    .sort((a, b) => a.productName.localeCompare(b.productName) || a.productCode.localeCompare(b.productCode))
    .slice(0, limit)
}

/** SKUs with on-hand stock at this branch for one model. */
export async function listSaleVariantsAtBranch(branchId: string, productId: string): Promise<VariantOption[]> {
  const [rows, reservedFor] = await Promise.all([listBranchStockFromApi(branchId, ''), reservedAt(branchId)])
  const db = readDb()
  const product = db.products.find((candidate) => candidate.id === productId)

  return rows
    .filter((row) => row.productId === productId)
    .map((row) => ({
      variantId: row.variantId,
      sku: row.sku,
      barcode: row.barcode,
      productId: row.productId,
      productName: row.productName,
      productCode: product?.code ?? '',
      size: row.size,
      color: row.color,
      sellPrice: row.sellPrice,
      available: sellableLessReserved(row.available, reservedFor(row.variantId)),
    }))
    .sort((a, b) => a.color.localeCompare(b.color) || a.size.localeCompare(b.size) || a.sku.localeCompare(b.sku))
}
