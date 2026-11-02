import { readDb, writeDb } from '@/mocks/store'
import { resolveWarehouseId, type ResolveWarehouseOptions } from '@/services/warehouse-link.service'

/** Reads the main inventory branch id from the mirror, then the API if needed. */
export async function getWarehouseId(options: ResolveWarehouseOptions = {}): Promise<string | null> {
  return resolveWarehouseId(options)
}

export async function setWarehouse(branchId: string): Promise<string> {
  const db = readDb()
  const branch = db.branches.find((candidate) => candidate.id === branchId)
  if (!branch) throw new Error('That branch is not known yet. Reload the branch list and try again.')
  writeDb((current) => {
    current.warehouseId = branchId
  })
  return branch.name
}
