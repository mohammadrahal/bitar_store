import { mapApiBranch } from '@/lib/api/map-branch'
import { matchesBranchSlug } from '@/lib/branch-slug'
import { can } from '@/lib/permissions'
import { mirrorBranches } from '@/mocks/mirror'
import { useUserStore } from '@/store/user-store'
import { getApiClient } from '@/lib/api'
import type { CreateBranchInput, UpdateBranchInput } from '@/lib/api/types'
import { syncWarehouseFromBranchList } from '@/services/warehouse-link.service'
import { ALL_BRANCHES, type Branch, type BranchKind, type BranchScope } from '@/types'
import { getBranchStockUnits } from '@/services/stock.service'

async function refreshBranchesAfterWrite(): Promise<Branch[]> {
  const api = getApiClient()
  const branches = (await api.listBranches()).map(mapApiBranch).sort((a, b) => a.name.localeCompare(b.name))
  mirrorBranches(branches, { prune: seesWholeNetwork() })
  syncWarehouseFromBranchList(branches)
  return branches
}

export interface BranchInput {
  code: string
  name: string
  kind?: BranchKind
}

/**
 * Whether the caller's `GET /branches` is the whole network. A manager or
 * employee is granted one branch, so their list says nothing about the rest
 * and must never be treated as complete.
 */
export function seesWholeNetwork(): boolean {
  const user = useUserStore.getState().user
  return user ? can(user, 'locations.view_all') : false
}

async function fetchScopedBranches(scope: BranchScope): Promise<Branch[]> {
  const api = getApiClient()
  const branches = (await api.listBranches()).map(mapApiBranch).sort((a, b) => a.name.localeCompare(b.name))
  /* The catalog needs to know these branches before it can hold stock, price
     a document or name a low-stock row. Mirror the full list, not the scoped
     one, so a scoped read never narrows what the catalog knows. */
  mirrorBranches(branches, { prune: seesWholeNetwork() })
  syncWarehouseFromBranchList(branches)
  if (scope === ALL_BRANCHES) return branches
  return branches.filter((branch) => branch.id === scope)
}

export async function listBranches(scope: BranchScope = ALL_BRANCHES): Promise<Branch[]> {
  return fetchScopedBranches(scope)
}

/** `segment` is what the URL carries: the store code, or an id from an older link. */
export async function getBranch(segment: string): Promise<Branch> {
  const branches = await fetchScopedBranches(ALL_BRANCHES)
  const branch = branches.find((candidate) => matchesBranchSlug(candidate, segment))
  if (!branch) throw new Error('Branch not found')
  return branch
}

function normalizeCreate(input: BranchInput): CreateBranchInput {
  return {
    code: input.code.trim(),
    name: input.name.trim(),
    /* The server defaults to `branch`, so only a warehouse has to be said. */
    kind: input.kind ?? 'branch',
  }
}

export async function createBranch(input: BranchInput): Promise<Branch> {
  const api = getApiClient()
  const payload = normalizeCreate(input)
  await api.createBranch(payload)
  const branches = await refreshBranchesAfterWrite()
  const code = payload.code.toUpperCase()
  const created = branches.find((candidate) => candidate.code?.toUpperCase() === code)
  if (!created) throw new Error('Branch was created but did not appear in the list.')
  return created
}

/** Server supports PATCH (name, isActive, kind) and DELETE when the branch has no history. */
export const BRANCH_WRITES = {
  update: true,
  deactivate: true,
  delete: true,
} as const

export async function updateBranch(branchId: string, input: UpdateBranchInput): Promise<Branch> {
  if (!BRANCH_WRITES.update) throw new Error('Branch editing is not available.')
  const patched = mapApiBranch(await getApiClient().updateBranch(branchId, input))
  let branches = await refreshBranchesAfterWrite()
  /* Trust the PATCH body for fields we just sent — some list responses lag role changes. */
  const index = branches.findIndex((candidate) => candidate.id === branchId)
  if (index !== -1) {
    branches = branches.map((candidate, i) => (i === index ? { ...candidate, ...patched } : candidate))
    mirrorBranches(branches, { prune: seesWholeNetwork() })
    syncWarehouseFromBranchList(branches)
  }
  const updated = branches.find((candidate) => candidate.id === branchId) ?? patched
  return updated
}

export async function setBranchActive(branchId: string, isActive: boolean): Promise<Branch> {
  if (!BRANCH_WRITES.update) throw new Error('Branch status changes are not available.')
  return mapApiBranch(await getApiClient().updateBranch(branchId, { isActive }))
}

/** Marks the branch inactive. Fails when stock remains on hand. */
export async function deactivateBranch(branchId: string): Promise<Branch> {
  if (!BRANCH_WRITES.deactivate) throw new Error('Branch deactivation is not available.')
  const units = await getBranchStockUnits(branchId)
  if (units > 0) {
    throw new Error(
      `This branch still holds ${units.toLocaleString()} units. Move or sell stock before marking it inactive.`,
    )
  }
  return setBranchActive(branchId, false)
}

/** Removes the branch permanently. The server returns `409` when it has any history. */
export async function deleteBranch(branchId: string): Promise<void> {
  if (!BRANCH_WRITES.delete) throw new Error('Branch deletion is not available.')
  await getApiClient().deleteBranch(branchId)
  await refreshBranchesAfterWrite()
}
