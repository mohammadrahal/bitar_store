import type { RequestFn } from '@/lib/api/client'
import type { ApiBranch, CreateBranchInput, UpdateBranchInput } from '@/lib/api/types'

export function createBranchesApi(request: RequestFn) {
  return {
    listBranches: () => request<ApiBranch[]>('/branches'),
    createBranch: (input: CreateBranchInput) => request<ApiBranch>('/branches', 'POST', input),
    updateBranch: (id: string, changes: UpdateBranchInput) =>
      request<ApiBranch>(`/branches/${id}`, 'PATCH', changes),
  }
}

export type BranchesApi = ReturnType<typeof createBranchesApi>
