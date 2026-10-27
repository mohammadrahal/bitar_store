'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useProductMutationCallbacks } from '@/hooks/use-products'
import { queryKeys } from '@/lib/query-keys'
import {
  addBarcode,
  generateBarcode,
  listPriceHistory,
  removeBarcode,
  setVariantActive,
  setVariantPrice,
} from '@/services/skus.service'

export function usePriceHistory(variantId: string | null) {
  return useQuery({
    queryKey: queryKeys.products.priceHistory(variantId ?? ''),
    queryFn: () => listPriceHistory(variantId ?? ''),
    enabled: Boolean(variantId),
  })
}

export function useSetVariantPrice() {
  const { invalidate, reportError } = useProductMutationCallbacks()
  return useMutation({
    mutationFn: ({ variantId, price }: { variantId: string; price: number; sku: string }) => setVariantPrice(variantId, price),
    onSuccess: (_result, { sku }) => {
      invalidate()
      toast.success(`New price saved for ${sku}`)
    },
    onError: reportError,
  })
}

export function useSetVariantActive() {
  const { invalidate, reportError } = useProductMutationCallbacks()
  return useMutation({
    mutationFn: ({ variantId, isActive }: { variantId: string; isActive: boolean; sku: string }) =>
      setVariantActive(variantId, isActive),
    onSuccess: (_result, { sku, isActive }) => {
      invalidate()
      toast.success(isActive ? `${sku} is on sale again` : `${sku} deactivated`)
    },
    onError: reportError,
  })
}

/* Failures, such as a barcode already on another SKU, are shown under the barcode field instead of a toast. */
export function useAddBarcode() {
  const { invalidate } = useProductMutationCallbacks()
  return useMutation({
    mutationFn: ({ variantId, code }: { variantId: string; code: string }) => addBarcode(variantId, code),
    onSuccess: (barcode) => {
      invalidate()
      toast.success(`Barcode ${barcode.code} added`)
    },
  })
}

export function useGenerateBarcode() {
  const { invalidate, reportError } = useProductMutationCallbacks()
  return useMutation({
    mutationFn: ({ variantId }: { variantId: string }) => generateBarcode(variantId),
    onSuccess: (barcode) => {
      invalidate()
      toast.success(`Barcode ${barcode.code} generated`)
    },
    onError: reportError,
  })
}

export function useRemoveBarcode() {
  const { invalidate, reportError } = useProductMutationCallbacks()
  return useMutation({
    mutationFn: ({ barcodeId }: { barcodeId: string; code: string }) => removeBarcode(barcodeId),
    onSuccess: (_result, { code }) => {
      invalidate()
      toast.success(`Barcode ${code} removed`)
    },
    onError: reportError,
  })
}
