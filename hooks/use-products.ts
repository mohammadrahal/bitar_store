'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useBranchesKey, useCatalogSync } from '@/hooks/use-stock'
import { invalidateStockQueries } from '@/lib/invalidate-stock'
import { queryKeys, type ProductFilters } from '@/lib/query-keys'
import { setProductArchived } from '@/services/product-lifecycle.service'
import {
  addVariants,
  createProduct,
  listCategories,
  listProducts,
  updateProduct,
  type Combination,
  type CreatedProduct,
  type ProductDetailsInput,
  type ProductInput,
} from '@/services/products.service'
import { getProductDetail } from '@/services/skus.service'

/** One catalog sync shared across product screens; stock units use their own queries. */
function useCatalogReady(): boolean {
  const catalog = useCatalogSync()
  const branches = useBranchesKey()
  return catalog.data !== undefined && branches !== null
}

export function useProducts(filters: ProductFilters) {
  const ready = useCatalogReady()
  return useQuery({
    queryKey: queryKeys.products.list(filters),
    queryFn: () => listProducts(filters),
    enabled: ready,
    staleTime: 60_000,
  })
}

/** The model with every SKU's barcodes. */
export function useProduct(productId: string) {
  const ready = useCatalogReady()
  return useQuery({
    queryKey: queryKeys.products.detail(productId),
    queryFn: () => getProductDetail(productId),
    enabled: ready && Boolean(productId),
  })
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.products.categories(),
    queryFn: listCategories,
    staleTime: 60_000,
  })
}

export function useProductMutationCallbacks() {
  const queryClient = useQueryClient()
  return {
    invalidate: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      invalidateStockQueries(queryClient)
    },
    reportError: (error: Error) => toast.error(error.message),
  }
}

/** The model was saved even when some combinations were refused, so those are a warning, not a failure. */
function reportSkipped({ skipped, unbarcoded, openingFailed }: CreatedProduct) {
  if (openingFailed) {
    toast.warning('The model was saved, but its opening count did not post', { description: openingFailed })
  }
  if (skipped.length > 0) {
    toast.warning(`${skipped.length} ${skipped.length === 1 ? 'variant was' : 'variants were'} not added`, {
      description: skipped.join('\n'),
    })
  }
  if (unbarcoded.length > 0) {
    toast.warning(`${unbarcoded.length} ${unbarcoded.length === 1 ? 'variant has' : 'variants have'} no barcode yet`, {
      description: `Generate one from the barcodes button on the model page.\n${unbarcoded.join('\n')}`,
    })
  }
}

export function useCreateProduct() {
  const { invalidate, reportError } = useProductMutationCallbacks()
  return useMutation({
    mutationFn: (input: ProductInput) => createProduct(input),
    onSuccess: (result) => {
      invalidate()
      const { product } = result
      const count = product.variants.length
      const placed = result.opened
        ? ` · ${result.opened.lines} ${result.opened.lines === 1 ? 'line' : 'lines'} counted in`
        : ''
      toast.success(
        `${product.name} saved as ${product.code} with ${count} ${count === 1 ? 'variant' : 'variants'}${placed}`,
      )
      reportSkipped(result)
    },
    onError: reportError,
  })
}

export function useUpdateProduct() {
  const { invalidate, reportError } = useProductMutationCallbacks()
  return useMutation({
    mutationFn: ({ productId, input }: { productId: string; input: ProductDetailsInput }) => updateProduct(productId, input),
    onSuccess: (product) => {
      invalidate()
      toast.success(`${product.name} updated`)
    },
    onError: reportError,
  })
}

export function useAddVariants() {
  const { invalidate, reportError } = useProductMutationCallbacks()
  return useMutation({
    mutationFn: ({ productId, combos }: { productId: string; combos: Combination[] }) => addVariants(productId, combos),
    onSuccess: (result, { combos }) => {
      invalidate()
      const added = combos.length - result.skipped.length
      toast.success(`${added} ${added === 1 ? 'variant' : 'variants'} added to ${result.product.name}`)
      reportSkipped(result)
    },
    onError: reportError,
  })
}

export function useSetProductArchived() {
  const { invalidate, reportError } = useProductMutationCallbacks()
  return useMutation({
    mutationFn: ({ productId, archived }: { productId: string; archived: boolean }) =>
      setProductArchived(productId, archived),
    onSuccess: (product) => {
      invalidate()
      toast.success(product.archived ? `${product.name} archived` : `${product.name} is active again`)
    },
    onError: reportError,
  })
}
