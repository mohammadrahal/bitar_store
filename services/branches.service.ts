import { mapApiBranch } from '@/lib/api/map-branch'
import { getApiClient } from '@/lib/api'
import type { CreateBranchInput } from '@/lib/api/types'
import { ALL_BRANCHES, type Branch, type BranchScope } from '@/types'

export interface BranchInput {
  code: string
  name: string
}

async function fetchScopedBranches(scope: BranchScope): Promise<Branch[]> {
  const api = getApiClient()
  const branches = (await api.listBranches()).map(mapApiBranch).sort((a, b) => a.name.localeCompare(b.name))
  if (scope === ALL_BRANCHES) return branches
  return branches.filter((branch) => branch.id === scope)
}

export async function listBranches(scope: BranchScope = ALL_BRANCHES): Promise<Branch[]> {
  return fetchScopedBranches(scope)
}

export async function getBranch(branchId: string): Promise<Branch> {
  const branches = await fetchScopedBranches(ALL_BRANCHES)
  const branch = branches.find((candidate) => candidate.id === branchId)
  if (!branch) throw new Error('Branch not found')
  return branch
}

function normalizeCreate(input: BranchInput): CreateBranchInput {
  return {
    code: input.code.trim(),
    name: input.name.trim(),
  }
}

export async function createBranch(input: BranchInput): Promise<Branch> {
  const api = getApiClient()
  const branch = await api.createBranch(normalizeCreate(input))
  return mapApiBranch(branch)
}

/** Not supported by the API yet — kept so older UI imports still type-check. */
export async function updateBranch(_branchId: string, _input: never): Promise<Branch> {
  throw new Error('Branch updates are not available on the server yet.')
}

export async function setBranchActive(_branchId: string, _isActive: boolean): Promise<Branch> {
  throw new Error('Branch status changes are not available on the server yet.')
}

export async function deleteBranch(_branchId: string): Promise<void> {
  throw new Error('Branch deletion is not available on the server yet.')
}
