import type { ApiBarcode, ApiPriceChange, ApiSku, ApiStyle } from '@/lib/api/types'
import type { Barcode, PriceChange, Product, Variant } from '@/types'

/** Shown for a style saved without a category. */
export const UNCATEGORIZED = 'Uncategorized'
export const DEFAULT_CURRENCY = 'USD'

export function priceOf(text: string): number {
  const value = Number(text)
  return Number.isFinite(value) ? value : 0
}

/** The API takes money as text with at most two decimals. */
export function priceText(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2)
}

/** "MD000123-BLK-S" on style MD000123 -> "BLK-S". */
export function variantCodeOf(skuCode: string, styleCode: string): string {
  const prefix = `${styleCode}-`
  return skuCode.startsWith(prefix) ? skuCode.slice(prefix.length) : skuCode
}

export function mapApiSku(sku: ApiSku, styleCode: string, barcode = ''): Variant {
  return {
    id: sku.id,
    productId: sku.styleId,
    sku: sku.skuCode,
    code: variantCodeOf(sku.skuCode, styleCode),
    barcode,
    size: sku.size,
    color: sku.color,
    sellPrice: priceOf(sku.standardPrice),
    currency: sku.currency,
    archived: !sku.isActive,
  }
}

/** Cost and the extra details are not on the API, so they come from what this device already knows. */
export function mapApiStyle(style: ApiStyle, variants: Variant[]): Product {
  const prices = variants.filter((variant) => !variant.archived).map((variant) => variant.sellPrice)
  return {
    id: style.id,
    code: style.code,
    name: style.name,
    category: style.category?.trim() || UNCATEGORIZED,
    sellPrice: prices.length ? Math.min(...prices) : 0,
    archived: !style.isActive,
    createdAt: style.createdAt,
  }
}

export function mapApiBarcode(barcode: ApiBarcode): Barcode {
  return { id: barcode.id, code: barcode.code, createdAt: barcode.createdAt }
}

export function mapApiPriceChange(change: ApiPriceChange): PriceChange {
  return {
    id: change.id,
    oldPrice: change.oldPrice === null ? null : priceOf(change.oldPrice),
    newPrice: priceOf(change.newPrice),
    effectiveAt: change.effectiveAt,
    changedBy: change.changedBy,
  }
}
