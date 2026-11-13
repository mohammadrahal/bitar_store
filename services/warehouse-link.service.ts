import { ApiError, getApiClient } from '@/lib/api'
import {
  isApiFeatureAvailable,
  isApiFeatureMissing,
  noteMissingApiFeature,
  probedWarehouse,
} from '@/lib/api/capabilities'
import { mapApiBranch } from '@/lib/api/map-branch'
import type { ApiLocation, ApiTransfer } from '@/lib/api/types'
import { readDb, writeDb } from '@/lib/catalog-cache/store'
import { mirrorBranches } from '@/lib/catalog-cache/mirror'
import { canSeeTransfers } from '@/lib/api-access'
import { seesWholeNetwork } from '@/services/branches.service'
import { useUserStore } from '@/store/user-store'
import type { Branch, User } from '@/types'

/** Set after a successful warehouse lookup. There is only one warehouse. */
let cachedWarehouseId: string | null = null

export function clearWarehouseCache() {
  cachedWarehouseId = null
  writeDb((db) => {
    db.warehouseId = null
  })
}

/** Keep the in-memory warehouse id aligned with `GET /branches` after a role change. */
export function syncWarehouseFromBranchList(branches: Branch[]) {
  const warehouse = branches.find((branch) => branch.kind === 'warehouse')
  if (warehouse) rememberWarehouse(warehouse)
  else clearWarehouseCache()
}

export function rememberWarehouse(location: ApiLocation | Branch) {
  cachedWarehouseId = location.id
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

function warehouseMarkedLocally(): string | null {
  const marked = readDb().branches.find((branch) => branch.kind === 'warehouse')
  return marked?.id ?? readDb().warehouseId ?? null
}

function hasSessionToken(): boolean {
  return Boolean(useUserStore.getState().token)
}

async function fromWarehouseEndpoint(): Promise<string | null> {
  if (!hasSessionToken() || isApiFeatureMissing('warehouse')) return null
  try {
    const warehouse = await getApiClient().getWarehouse()
    rememberWarehouse({ ...warehouse, kind: 'warehouse' })
    return warehouse.id
  } catch (error) {
    noteMissingApiFeature(error, 'warehouse')
    return null
  }
}

async function syncBranchesFromApi(): Promise<string | null> {
  if (!hasSessionToken()) return null
  try {
    const branches = (await getApiClient().listBranches()).map(mapApiBranch)
    mirrorBranches(branches, { prune: seesWholeNetwork() })
    return warehouseMarkedLocally()
  } catch {
    return null
  }
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
      /* Branch staff often cannot read suggestions. */
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

async function fromStockOverview(): Promise<string | null> {
  if (!hasSessionToken()) return null
  try {
    const overview = await getApiClient().getStockOverview({ limit: 1 })
    const warehouse = overview.locations.find((location) => location.kind === 'warehouse')
    if (warehouse) {
      rememberWarehouse(warehouse)
      return warehouse.id
    }
  } catch {
    /* Admin-only; branch users skip. */
  }
  return null
}

export interface ResolveWarehouseOptions {
  branchId?: string
}

/**
 * Resolves the warehouse id: `GET /warehouse` when the server has it, otherwise
 * branches with `kind: "warehouse"`, replenishment, transfers, or stock overview.
 */
export async function resolveWarehouseId(options: ResolveWarehouseOptions = {}): Promise<string | null> {
  const branchId =
    options.branchId ??
    useUserStore.getState().user?.branchId ??
    useUserStore.getState().user?.branchIds[0] ??
    undefined

  const cached = cachedWarehouseId ?? warehouseMarkedLocally()
  if (cached) {
    const stillWarehouse = readDb().branches.some(
      (branch) => branch.id === cached && branch.kind === 'warehouse',
    )
    if (stillWarehouse) return cached
    clearWarehouseCache()
  }

  if (!hasSessionToken()) return null

  /* The capability probe already read `GET /warehouse` for this token. Asking
     again would send the same request a second time on every first load. */
  const probed = probedWarehouse()
  if (probed) {
    rememberWarehouse({ ...probed, kind: 'warehouse' })
    return probed.id
  }

  if (isApiFeatureAvailable('warehouse') || !isApiFeatureMissing('warehouse')) {
    const fromEndpoint = await fromWarehouseEndpoint()
    if (fromEndpoint) return fromEndpoint
  }

  const fromList = await syncBranchesFromApi()
  if (fromList) return fromList

  const fromSuggest = await fromReplenishment(branchId)
  if (fromSuggest) return fromSuggest

  const fromXfer = await fromTransfers(branchId)
  if (fromXfer) return fromXfer

  const fromOverview = await fromStockOverview()
  if (fromOverview) return fromOverview

  return null
}

/** After login, prefetch the warehouse when this user works with transfers. */
export function warmWarehouseLink(user: User): void {
  if (!canSeeTransfers(user)) return
  const branchId = user.branchId ?? user.branchIds[0]
  void resolveWarehouseId({ branchId })
}
