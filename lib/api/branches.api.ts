import type { RequestFn } from '@/lib/api/client'
import type { ApiBranch, CreateBranchInput, UpdateBranchInput } from '@/lib/api/types'

export function createBranchesApi(request: RequestFn) {
  return {
    listBranches: () => request<ApiBranch[]>('/branches'),
    createBranch: (input: CreateBranchInput) => request<ApiBranch>('/branches', 'POST', input),
    /* Not on the server yet: PATCH and DELETE /branches both answer 404. The
       shape is here so enabling them is a flag flip in branches.service. */
    updateBranch: (id: string, changes: UpdateBranchInput) =>
      request<ApiBranch>(`/branches/${id}`, 'PATCH', changes),
    deleteBranch: (id: string) => request<void>(`/branches/${id}`, 'DELETE'),
  }
}

export type BranchesApi = ReturnType<typeof createBranchesApi>
