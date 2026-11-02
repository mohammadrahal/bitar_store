'use client'

import { useCatalogSync } from '@/hooks/use-stock'

/** Warms the mirrored catalog once per session so product and stock screens start faster. */
export function CatalogPrefetch() {
  useCatalogSync()
  return null
}
