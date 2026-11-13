import { isRetired, readDb } from '@/lib/catalog-cache/store'
import { resolveSkuReferenceToId, searchVariants } from '@/services/variant-search.service'

export interface SearchHit {
  kind: 'variant' | 'product'
  id: string
  href: string
  /** `Model · Colour · Size` for a variant, the model name for a style. */
  title: string
  /** SKU and barcode, or the style code and category. */
  subtitle: string
}

/**
 * Something a barcode scanner could have produced: one printable token, no
 * spaces, long enough not to be a word somebody typed. A scanner types the code
 * and then sends Enter, so a match on this shape is resolved against the API
 * and opened directly rather than being offered as one result among several.
 */
const SCANNABLE = /^[\x21-\x7E]{6,64}$/

export function looksScanned(term: string): boolean {
  return SCANNABLE.test(term.trim())
}

/**
 * Catalog matches for the header's search, newest intent first: variants, then
 * the models above them.
 *
 * Variants come from `searchVariants`, which reads the mirrored catalog and
 * falls back to `GET /skus/lookup` for a barcode it has never seen. so a code
 * printed on a tag finds its variant even on a fresh session.
 *
 * Sale references are **not** searched: the API has no route that resolves a
 * reference to a sale, and `GET /sales/history` takes no search term, so there
 * is nothing to ask. The gap is listed in `ARCHITECTURE.md` section 9.
 */
export async function searchEverything(term: string, limit = 7): Promise<SearchHit[]> {
  const trimmed = term.trim()
  if (trimmed.length < 2) return []

  const variants = await searchVariants(trimmed, limit)
  const hits: SearchHit[] = variants.map((variant) => ({
    kind: 'variant',
    id: variant.variantId,
    href: `/inventory/${variant.variantId}`,
    title: [variant.productName, variant.color, variant.size].filter(Boolean).join(' · '),
    subtitle: [variant.sku, variant.barcode].filter(Boolean).join(' · '),
  }))

  const needle = trimmed.toLowerCase()
  const db = readDb()
  const seen = new Set(variants.map((variant) => variant.productId))
  for (const product of db.products) {
    if (hits.length >= limit * 2) break
    if (product.archived || seen.has(product.id)) continue
    const haystack = `${product.name} ${product.code} ${product.category}`.toLowerCase()
    if (!haystack.includes(needle)) continue
    /* A model with nothing sellable left is history, not something to open from
       a search box. */
    const live = db.variants.some((variant) => variant.productId === product.id && !isRetired(db, variant))
    if (!live) continue
    hits.push({
      kind: 'product',
      id: product.id,
      href: `/products/${product.id}`,
      title: product.name,
      subtitle: [product.code, product.category].filter(Boolean).join(' · '),
    })
  }

  return hits
}

/** A scanned code to the variant it names, or null when the API knows no such code. */
export async function resolveScannedCode(code: string): Promise<string | null> {
  return resolveSkuReferenceToId(code)
}
