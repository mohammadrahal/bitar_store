import { getApiClient } from '@/lib/api'
import { mapApiBarcode, mapApiPriceChange, mapApiSku, priceText } from '@/lib/api/map-catalog'
import { mirrorCatalog } from '@/mocks/mirror'
import { getProduct } from '@/services/products.service'
import type { Barcode, PriceChange, ProductDetail } from '@/types'

/** The model with every SKU's barcodes, which only the single-SKU endpoint returns. */
export async function getProductDetail(productId: string): Promise<ProductDetail> {
  const product = await getProduct(productId)
  const api = getApiClient()
  const details = await Promise.all(product.variants.map((variant) => api.getSku(variant.id)))
  const barcodes: Record<string, Barcode[]> = {}
  for (const sku of details) barcodes[sku.id] = sku.barcodes.map(mapApiBarcode)

  const variants = details.map((sku) => mapApiSku(sku, product.code, sku.barcodes[0]?.code ?? ''))
  mirrorCatalog([], variants)
  const livePrices = variants.filter((variant) => !variant.archived).map((variant) => variant.sellPrice)
  return {
    ...product,
    sellPrice: livePrices.length ? Math.min(...livePrices) : product.sellPrice,
    variants,
    barcodes,
  }
}

/** Recorded in the SKU's price history by the API. */
export async function setVariantPrice(variantId: string, price: number): Promise<void> {
  await getApiClient().setSkuPrice(variantId, priceText(price))
}

export async function listPriceHistory(variantId: string): Promise<PriceChange[]> {
  return (await getApiClient().getPriceHistory(variantId, 50)).map(mapApiPriceChange)
}

/**
 * An inactive SKU leaves sale and transfer pickers; its history stays.
 * Archiving is refused while it still holds units anywhere, which
 * `setVariantArchived` checks.
 */
export async function setVariantActive(variantId: string, isActive: boolean): Promise<void> {
  const { setVariantArchived } = await import('@/services/product-lifecycle.service')
  await setVariantArchived(variantId, !isActive)
}

export async function addBarcode(variantId: string, code: string): Promise<Barcode> {
  return mapApiBarcode(await getApiClient().addBarcode(variantId, code.trim()))
}

export { mintBarcode as generateBarcode } from '@/services/barcodes.service'

export async function removeBarcode(barcodeId: string): Promise<void> {
  await getApiClient().deleteBarcode(barcodeId)
}
