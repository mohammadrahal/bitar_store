import type { RequestFn } from '@/lib/api/client'
import type { ApiBranch, CreateBranchInput } from '@/lib/api/types'

export function createBranchesApi(request: RequestFn) {
  return {
    listBranches: () => request<ApiBranch[]>('/branches'),
    createBranch: (input: CreateBranchInput) => request<ApiBranch>('/branches', 'POST', input),
  }
}

export type BranchesApi = ReturnType<typeof createBranchesApi>
