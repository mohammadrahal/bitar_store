import type { RequestFn } from '@/lib/api/client'
import { queryOf } from '@/lib/api/query'
import type { ApiCategory, UpdateCategoryInput } from '@/lib/api/types'

export function createCategoriesApi(request: RequestFn) {
  return {
    listCategories: (params: { activeOnly?: boolean } = {}) =>
      request<ApiCategory[]>(`/categories${queryOf({ ...params })}`),
    createCategory: (name: string) => request<ApiCategory>('/categories', 'POST', { name }),
    updateCategory: (id: string, input: UpdateCategoryInput) =>
      request<ApiCategory>(`/categories/${id}`, 'PATCH', input),
    deleteCategory: (id: string) => request<void>(`/categories/${id}`, 'DELETE'),
  }
}

export type CategoriesApi = ReturnType<typeof createCategoriesApi>
