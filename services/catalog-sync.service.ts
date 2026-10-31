import { getApiClient } from '@/lib/api'
import { mapApiSku, mapApiStyle } from '@/lib/api/map-catalog'
import type { ApiSku, ApiStyle } from '@/lib/api/types'
import { mirrorCatalog } from '@/mocks/mirror'
import { readDb } from '@/mocks/store'
import type { Product, Variant } from '@/types'

/** The API's largest page. */
const PAGE = 200

async function fetchAll<T>(page: (offset: number) => Promise<T[]>): Promise<T[]> {
  const all: T[] = []
  for (let offset = 0; ; offset += PAGE) {
    const rows = await page(offset)
    all.push(...rows)
    if (rows.length < PAGE) return all
  }
}

/** Styles as products and SKUs as variants, keeping the barcodes already mirrored. */
export function toCatalog(styles: ApiStyle[], skus: ApiSku[]): { products: Product[]; variants: Variant[] } {
  const db = readDb()
  const codeOf = new Map(styles.map((style) => [style.id, style.code]))
  const barcodeOf = new Map(db.variants.map((variant) => [variant.id, variant.barcode]))
  const variants = skus.map((sku) => mapApiSku(sku, codeOf.get(sku.styleId) ?? '', barcodeOf.get(sku.id)))
  const products = styles.map((style) =>
    mapApiStyle(
      style,
      variants.filter((variant) => variant.productId === style.id),
    ),
  )
  return { products, variants }
}

let inFlight: Promise<number> | null = null

/**
 * Fetches the whole catalog and mirrors it, so stock, transfers and documents
 * see the real styles and SKUs. Concurrent callers share one fetch. Resolves
 * to the number of SKUs, which changes when the catalog does.
 */
export function syncCatalog(): Promise<number> {
  inFlight ??= (async () => {
    try {
      const api = getApiClient()
      const [styles, skus] = await Promise.all([
        fetchAll((offset) => api.listStyles({ limit: PAGE, offset })),
        fetchAll((offset) => api.listSkus({ limit: PAGE, offset })),
      ])
      const { products, variants } = toCatalog(styles, skus)
      mirrorCatalog(products, variants, { complete: true })
      return variants.length
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

/** Re-reads one style with its SKUs and mirrors it. */
export async function refreshStyle(styleId: string): Promise<void> {
  const { skus, ...style } = await getApiClient().getStyle(styleId)
  const { products, variants } = toCatalog([style], skus)
  mirrorCatalog(products, variants)
}
