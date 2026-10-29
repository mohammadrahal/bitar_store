'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { useMirroredBranches } from '@/hooks/use-stock'
import { listSaleModels, listSaleVariants } from '@/services/sale-picker.service'

export function useSaleModels(search: string) {
  const mirrored = useMirroredBranches()
  return useQuery({
    queryKey: queryKeys.stock.saleModels(search),
    queryFn: () => listSaleModels(search),
    enabled: mirrored !== null,
  })
}

export function useSaleVariants(branchId: string, productId: string | null) {
  const mirrored = useMirroredBranches()
  return useQuery({
    queryKey: queryKeys.stock.saleVariants(branchId, productId ?? ''),
    queryFn: () => listSaleVariants(branchId, productId!),
    enabled: mirrored !== null && Boolean(branchId && productId),
  })
}
