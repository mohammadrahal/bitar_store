import { getApiClient } from '@/lib/api'
import { mapApiBranch } from '@/lib/api/map-branch'
import type { ApiLocation, ApiTransfer } from '@/lib/api/types'
import { readDb, writeDb } from '@/mocks/store'
import { mirrorBranches } from '@/mocks/mirror'
import { canSeeTransfers } from '@/lib/api-access'
import { seesWholeNetwork } from '@/services/branches.service'
import { useUserStore } from '@/store/user-store'
import type { Branch, User } from '@/types'

const WAREHOUSE_PATTERN = /warehouse|depot|\bwh\b|^wh[-_]?|main|hub/i

function warehouseFromBranches(branches: Branch[]): string | null {
  const marked = branches.find((branch) => branch.kind === 'warehouse')
  if (marked) return marked.id
  const match = branches.find(
    (branch) => WAREHOUSE_PATTERN.test(branch.name) || WAREHOUSE_PATTERN.test(branch.code ?? ''),
  )
  return match?.id ?? null
}

export function rememberWarehouse(location: ApiLocation | Branch) {
  writeDb((db) => {
    db.warehouseId = location.id
    const existing = db.branches.find((branch) => branch.id === location.id)
    if (!existing) {
      db.branches.push({
        id: location.id,
        name: location.name,
        kind: 'warehouse',
        code: 'code' in location ? location.code : undefined,
        location: location.name,
        isActive: true,
        createdAt: new Date().toISOString(),
      })
    } else {
      existing.kind = 'warehouse'
      existing.name = location.name
      if ('code' in location && location.code) existing.code = location.code
    }
  })
}

function fromMirror(): string | null {
  const db = readDb()
  return warehouseFromBranches(db.branches) ?? db.warehouseId
}

function hasSessionToken(): boolean {
  return Boolean(useUserStore.getState().token)
}

async function fromWarehouseEndpoint(): Promise<string | null> {
  if (!hasSessionToken()) return null
  try {
    const warehouse = await getApiClient().getWarehouse()
    rememberWarehouse({ ...warehouse, kind: 'warehouse' })
    return warehouse.id
  } catch {
    return null
  }
}

async function syncBranchesFromApi(): Promise<string | null> {
  if (!hasSessionToken()) return null
  try {
    const api = getApiClient()
    const branches = (await api.listBranches()).map(mapApiBranch)
    mirrorBranches(branches, { prune: seesWholeNetwork() })
    return warehouseFromBranches(readDb().branches) ?? readDb().warehouseId
  } catch {
    return null
  }
}

/** Warehouse branch id among locations this user was granted (`GET /auth/me` → branchIds). */
function warehouseFromGrantedBranches(): string | null {
  const user = useUserStore.getState().user
  if (!user) return null
  const db = readDb()
  for (const id of user.branchIds) {
    const branch = db.branches.find((candidate) => candidate.id === id)
    if (!branch) continue
    if (branch.kind === 'warehouse' || WAREHOUSE_PATTERN.test(branch.name) || WAREHOUSE_PATTERN.test(branch.code ?? '')) {
      rememberWarehouse(branch)
      return branch.id
    }
  }
  return null
}

async function fromReplenishment(branchId?: string): Promise<string | null> {
  if (!hasSessionToken()) return null
  const attempts: ({ branchId?: string } | undefined)[] = branchId ? [{ branchId }, {}] : [{}]
  for (const params of attempts) {
    try {
      const suggestions = await getApiClient().getReplenishmentSuggestions(params ?? {})
      if (suggestions.warehouse?.id) {
        rememberWarehouse(suggestions.warehouse)
        return suggestions.warehouse.id
      }
    } catch {
      /* Branch staff often cannot read suggestions; try the next params. */
    }
  }
  return null
}

function warehouseFromTransfer(transfer: ApiTransfer): string | null {
  if (transfer.from.kind === 'warehouse') {
    rememberWarehouse(transfer.from)
    return transfer.from.id
  }
  if (transfer.to.kind === 'warehouse') {
    rememberWarehouse(transfer.to)
    return transfer.to.id
  }
  return null
}

async function fromTransfers(branchId?: string): Promise<string | null> {
  if (!hasSessionToken()) return null
  const filters: ({ branchId?: string } | undefined)[] = branchId ? [{ branchId }, {}] : [{}]
  for (const params of filters) {
    try {
      const page = await getApiClient().listTransfersPage({ limit: 50, ...params })
      for (const transfer of page.items) {
        const id = warehouseFromTransfer(transfer)
        if (id) return id
      }
    } catch {
      /* No transfer access yet. */
    }
  }
  return null
}

function fromEnv(): string | null {
  const envId = process.env.NEXT_PUBLIC_WAREHOUSE_BRANCH_ID?.trim()
  if (!envId) return null
  rememberWarehouse({ id: envId, code: 'WAREHOUSE', name: 'Main warehouse', kind: 'warehouse' })
  return envId
}

export interface ResolveWarehouseOptions {
  /** Branch the replenishment is for (Saida, etc.). Used for scoped API reads. */
  branchId?: string
}

/**
 * Finds the main warehouse branch id from the mirror, branch list, replenishment,
 * past transfers, or env. Safe to call often (login, form open, submit).
 */
export async function resolveWarehouseId(options: ResolveWarehouseOptions = {}): Promise<string | null> {
  const branchId =
    options.branchId ??
    useUserStore.getState().user?.branchId ??
    useUserStore.getState().user?.branchIds[0] ??
    undefined

  const cached = fromMirror()
  if (cached) return cached

  if (!hasSessionToken()) return fromEnv()

  /* Prefer the branch list (warehouse has kind `warehouse`). GET /warehouse is
     optional on the server; calling it first caused 404 noise on older APIs. */
  const fromList = await syncBranchesFromApi()
  if (fromList) return fromList

  const fromGrant = warehouseFromGrantedBranches()
  if (fromGrant) return fromGrant

  const fromEndpoint = await fromWarehouseEndpoint()
  if (fromEndpoint) return fromEndpoint

  const fromSuggest = await fromReplenishment(branchId)
  if (fromSuggest) return fromSuggest

  const fromXfer = await fromTransfers(branchId)
  if (fromXfer) return fromXfer

  return fromEnv()
}

/** After login, prefetch the warehouse into the local mirror when this user cares about transfers. */
export function warmWarehouseLink(user: User): void {
  if (!canSeeTransfers(user)) return
  const branchId = user.branchId ?? user.branchIds[0]
  void resolveWarehouseId({ branchId })
}
