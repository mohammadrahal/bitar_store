import { isLocationScoped } from '@/lib/permissions'
import type { MockDb } from '@/mocks/store'
import { useUserStore } from '@/store/user-store'
import { ALL_BRANCHES, type BranchScope } from '@/types'

/*
 * What the signed-in user may read, applied over the mirrored branch list.
 * Quantities come from the API; nothing here holds stock of its own.
 */

export function branchNameOf(db: MockDb, branchId: string) {
  return db.branches.find((branch) => branch.id === branchId)?.name ?? 'Unknown location'
}

/**
 * The scope a caller may actually read. Branch-scoped roles asking for every
 * location, or for someone else's, get their own branch instead.
 */
export function visibleScope(scope: BranchScope): BranchScope {
  const user = useUserStore.getState().user
  if (!user || !isLocationScoped(user)) return scope
  if (scope !== ALL_BRANCHES && user.branchIds.includes(scope)) return scope
  return user.branchId ?? '__none__'
}

export function visibleBranchIds(db: MockDb): string[] {
  const user = useUserStore.getState().user
  if (!user || !isLocationScoped(user)) return db.branches.map((branch) => branch.id)
  return db.branches.filter((branch) => user.branchIds.includes(branch.id)).map((branch) => branch.id)
}
