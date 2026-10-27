import { mapApiBranch } from '@/lib/api/map-branch'
import { can } from '@/lib/permissions'
import { mirrorBranches } from '@/mocks/mirror'
import { useUserStore } from '@/store/user-store'
import { getApiClient } from '@/lib/api'
import type { CreateBranchInput, UpdateBranchInput } from '@/lib/api/types'
import { ALL_BRANCHES, type Branch, type BranchScope } from '@/types'

export interface BranchInput {
  code: string
  name: string
}

/**
 * Whether the caller's `GET /branches` is the whole network. A manager or
 * employee is granted one branch, so their list says nothing about the rest
 * and must never be treated as complete.
 */
function seesWholeNetwork(): boolean {
  const user = useUserStore.getState().user
  return user ? can(user.role, 'branches:view-all') : false
}

async function fetchScopedBranches(scope: BranchScope): Promise<Branch[]> {
  const api = getApiClient()
  const branches = (await api.listBranches()).map(mapApiBranch).sort((a, b) => a.name.localeCompare(b.name))
  /* The catalog needs to know these branches before it can hold stock, price
     a document or name a low-stock row. Mirror the full list, not the scoped
     one, so a scoped read never narrows what the catalog knows. */
  mirrorBranches(branches, { prune: seesWholeNetwork() })
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

/**
 * What the server can actually do to a branch today. `PATCH /branches/:id` and
 * `DELETE /branches/:id` both answer 404, so the edit and delete controls read
 * these flags and explain themselves instead of failing on click.
 *
 * When the endpoints ship, flip the flag — the calls below and the whole UI
 * above them are already wired.
 */
export const BRANCH_WRITES = {
  update: false,
  delete: false,
  toggleActive: false,
} as const

const NOT_SUPPORTED = {
  update: 'Branch editing is not available on the server yet.',
  delete: 'Branch deletion is not available on the server yet.',
  toggleActive: 'Branch status changes are not available on the server yet.',
}

export async function updateBranch(branchId: string, input: UpdateBranchInput): Promise<Branch> {
  if (!BRANCH_WRITES.update) throw new Error(NOT_SUPPORTED.update)
  return mapApiBranch(await getApiClient().updateBranch(branchId, input))
}

export async function setBranchActive(branchId: string, isActive: boolean): Promise<Branch> {
  if (!BRANCH_WRITES.toggleActive) throw new Error(NOT_SUPPORTED.toggleActive)
  return mapApiBranch(await getApiClient().updateBranch(branchId, { isActive }))
}

export async function deleteBranch(branchId: string): Promise<void> {
  if (!BRANCH_WRITES.delete) throw new Error(NOT_SUPPORTED.delete)
  return getApiClient().deleteBranch(branchId)
}
