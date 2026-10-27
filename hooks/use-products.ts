'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useMirroredBranches } from '@/hooks/use-stock'
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

/* Reads wait for the catalog and branches to be mirrored, so stock figures beside them are real. */
export function useProducts(filters: ProductFilters) {
  const mirrored = useMirroredBranches()
  return useQuery({
    queryKey: queryKeys.products.list(filters),
    queryFn: () => listProducts(filters),
    enabled: mirrored !== null,
  })
}

/** The model with every SKU's barcodes. */
export function useProduct(productId: string) {
  const mirrored = useMirroredBranches()
  return useQuery({
    queryKey: queryKeys.products.detail(productId),
    queryFn: () => getProductDetail(productId),
    enabled: mirrored !== null && Boolean(productId),
  })
}

export function useCategories() {
  const mirrored = useMirroredBranches()
  return useQuery({
    queryKey: queryKeys.products.categories(),
    queryFn: listCategories,
    enabled: mirrored !== null,
  })
}

export function useProductMutationCallbacks() {
  const queryClient = useQueryClient()
  return {
    invalidate: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
    },
    reportError: (error: Error) => toast.error(error.message),
  }
}

/** The model was saved even when some combinations were refused, so those are a warning, not a failure. */
function reportSkipped({ skipped, unbarcoded }: CreatedProduct) {
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
      toast.success(`${product.name} saved as ${product.code} with ${count} ${count === 1 ? 'variant' : 'variants'}`)
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
