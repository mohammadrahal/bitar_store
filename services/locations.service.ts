import { getApiClient } from '@/lib/api'
import { mapApiBranch } from '@/lib/api/map-branch'
import { mirrorBranches } from '@/lib/catalog-cache/mirror'
import { seesWholeNetwork } from '@/services/branches.service'
import {
  clearWarehouseCache,
  resolveWarehouseId,
  syncWarehouseFromBranchList,
  type ResolveWarehouseOptions,
} from '@/services/warehouse-link.service'

/** Reads the main inventory branch id from the mirror, then the API if needed. */
export async function getWarehouseId(options: ResolveWarehouseOptions = {}): Promise<string | null> {
  return resolveWarehouseId(options)
}

/**
 * Marks one branch as the network warehouse (`PATCH /branches/:id` with
 * `kind: "warehouse"`). The server allows only one; an existing warehouse is
 * demoted to `branch` first.
 */
export async function setWarehouse(branchId: string): Promise<string> {
  const api = getApiClient()
  let branches = (await api.listBranches()).map(mapApiBranch)
  const target = branches.find((candidate) => candidate.id === branchId)
  if (!target) {
    throw new Error('That branch is not known yet. Reload the branch list and try again.')
  }
  if (!target.isActive) {
    throw new Error('Turn the branch active before making it the warehouse.')
  }
  if (target.kind === 'warehouse') return target.name

  const current = branches.find((candidate) => candidate.kind === 'warehouse')
  if (current && current.id !== branchId) {
    await api.updateBranch(current.id, { kind: 'branch' })
    clearWarehouseCache()
  }

  await api.updateBranch(branchId, { kind: 'warehouse' })
  branches = (await api.listBranches()).map(mapApiBranch)
  mirrorBranches(branches, { prune: seesWholeNetwork() })
  syncWarehouseFromBranchList(branches)
  const updated = branches.find((candidate) => candidate.id === branchId)
  return updated?.name ?? target.name
}
