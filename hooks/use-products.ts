'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys, type ProductFilters } from '@/lib/query-keys'
import {
  createProduct,
  deleteProduct,
  getProduct,
  listCategories,
  listProducts,
  updateProduct,
  type ProductInput,
} from '@/services/products.service'

export function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: queryKeys.products.list(filters),
    queryFn: () => listProducts(filters),
  })
}

export function useProduct(productId: string) {
  return useQuery({
    queryKey: queryKeys.products.detail(productId),
    queryFn: () => getProduct(productId),
    enabled: Boolean(productId),
  })
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.products.categories(),
    queryFn: listCategories,
  })
}

function useProductMutationCallbacks() {
  const queryClient = useQueryClient()
  return {
    invalidate: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
    },
    reportError: (error: Error) => toast.error(error.message),
  }
}

export function useCreateProduct() {
  const { invalidate, reportError } = useProductMutationCallbacks()
  return useMutation({
    mutationFn: (input: ProductInput) => createProduct(input),
    onSuccess: (product) => {
      invalidate()
      toast.success(`${product.name} added with ${product.variants.length} variants`)
    },
    onError: reportError,
  })
}

export function useUpdateProduct() {
  const { invalidate, reportError } = useProductMutationCallbacks()
  return useMutation({
    mutationFn: ({ productId, input }: { productId: string; input: ProductInput }) => updateProduct(productId, input),
    onSuccess: (product) => {
      invalidate()
      toast.success(`${product.name} updated`)
    },
    onError: reportError,
  })
}

export function useDeleteProduct() {
  const { invalidate, reportError } = useProductMutationCallbacks()
  return useMutation({
    mutationFn: ({ productId }: { productId: string; name: string }) => deleteProduct(productId),
    onSuccess: (_result, { name }) => {
      invalidate()
      toast.warning(`${name} deleted`)
    },
    onError: reportError,
  })
}
