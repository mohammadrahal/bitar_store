import { ApiError, getApiClient } from '@/lib/api'
import { apiFeatureHint, isApiFeatureMissing, noteMissingApiFeature } from '@/lib/api/capabilities'
import type { ApiCategory, UpdateCategoryInput } from '@/lib/api'

export function listCategoryRecords(activeOnly = false): Promise<ApiCategory[]> {
  if (isApiFeatureMissing('categories')) {
    throw new Error(apiFeatureHint('categories'))
  }
  return getApiClient()
    .listCategories(activeOnly ? { activeOnly: true } : {})
    .catch((error) => {
      noteMissingApiFeature(error, 'categories')
      if (error instanceof ApiError && error.status === 404) {
        throw new Error(apiFeatureHint('categories'))
      }
      throw error
    })
}

export function createCategory(name: string): Promise<ApiCategory> {
  return getApiClient().createCategory(name.trim())
}

export function updateCategory(id: string, input: UpdateCategoryInput): Promise<ApiCategory> {
  return getApiClient().updateCategory(id, input)
}

export function deleteCategory(id: string): Promise<void> {
  return getApiClient().deleteCategory(id)
}
