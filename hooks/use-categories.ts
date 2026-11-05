'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isApiFeatureMissing } from '@/lib/api/capabilities'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'
import {
  createCategory,
  deleteCategory,
  listCategoryRecords,
  updateCategory,
} from '@/services/categories.service'
import type { UpdateCategoryInput } from '@/lib/api'

export function useCategoryRecords(activeOnly = false) {
  return useQuery({
    queryKey: queryKeys.products.categoryRecords(activeOnly),
    queryFn: () => listCategoryRecords(activeOnly),
    enabled: !isApiFeatureMissing('categories'),
    staleTime: 60_000,
  })
}

function useCategoryMutations() {
  const queryClient = useQueryClient()
  return {
    invalidate: () => void queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
    reportError: (error: Error) => toast.error(error.message),
  }
}

export function useCreateCategory() {
  const { invalidate, reportError } = useCategoryMutations()
  return useMutation({
    mutationFn: (name: string) => createCategory(name),
    onSuccess: (category) => {
      invalidate()
      toast.success(`${category.name} added`)
    },
    onError: reportError,
  })
}

export function useUpdateCategory() {
  const { invalidate, reportError } = useCategoryMutations()
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateCategoryInput & { id: string }) => updateCategory(id, input),
    onSuccess: (category) => {
      invalidate()
      toast.success(`${category.name} updated`)
    },
    onError: reportError,
  })
}

export function useDeleteCategory() {
  const { invalidate, reportError } = useCategoryMutations()
  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      invalidate()
      toast.success('Category deleted')
    },
    onError: reportError,
  })
}
