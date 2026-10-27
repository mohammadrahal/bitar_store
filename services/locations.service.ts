import { delay, delayedFailure } from '@/lib/delay'
import { readDb, writeDb } from '@/mocks/store'

/*
 * The API has no location type yet, so which branch is the main warehouse is
 * kept beside the mock stock. When `GET /branches` returns a type, read it
 * from there and delete this file.
 */

export async function getWarehouseId(): Promise<string | null> {
  return delay(readDb().warehouseId, 0)
}

export async function setWarehouse(branchId: string): Promise<string> {
  const db = readDb()
  const branch = db.branches.find((candidate) => candidate.id === branchId)
  if (!branch) return delayedFailure('That branch is not known yet. Reload the branch list and try again.')
  writeDb((current) => {
    current.warehouseId = branchId
  })
  return delay(branch.name)
}
