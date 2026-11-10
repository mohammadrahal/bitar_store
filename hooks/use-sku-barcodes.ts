'use client'

import { useQuery } from '@tanstack/react-query'
import { getApiClient } from '@/lib/api'

/** Primary barcode per SKU id for invoice and receipt rows. */
export function useSkuBarcodes(skuIds: string[]) {
  const unique = [...new Set(skuIds.filter(Boolean))].sort()
  return useQuery({
    queryKey: ['skus', 'primary-barcode', unique.join(',')],
    queryFn: async () => {
      const api = getApiClient()
      const pairs = await Promise.all(
        unique.map(async (id) => {
          try {
            const detail = await api.getSku(id)
            const code = detail.barcodes.find((row) => row.code.trim())?.code ?? ''
            return [id, code] as const
          } catch {
            return [id, ''] as const
          }
        }),
      )
      return Object.fromEntries(pairs) as Record<string, string>
    },
    enabled: unique.length > 0,
    staleTime: 5 * 60_000,
  })
}

export function primaryBarcodeFor(
  skuId: string,
  map: Record<string, string> | undefined,
  inline?: string | null,
): string {
  const fromLine = inline?.trim()
  if (fromLine) return fromLine
  return map?.[skuId]?.trim() ?? ''
}
