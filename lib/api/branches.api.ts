import type { RequestFn } from '@/lib/api/client'
import type { ApiBranch, ApiPlace, ApiWarehouse, CreateBranchInput, UpdateBranchInput } from '@/lib/api/types'

export function createBranchesApi(request: RequestFn) {
  return {
    listBranches: () => request<ApiBranch[]>('/branches'),
    createBranch: (input: CreateBranchInput) => request<ApiBranch>('/branches', 'POST', input),
    updateBranch: (id: string, changes: UpdateBranchInput) =>
      request<ApiBranch>(`/branches/${id}`, 'PATCH', changes),
    deleteBranch: (id: string) => request<void>(`/branches/${id}`, 'DELETE'),
    getWarehouse: () => request<ApiWarehouse>('/warehouse'),
    listPlaces: () => request<ApiPlace[]>('/places'),
  }
}

export type BranchesApi = ReturnType<typeof createBranchesApi>
