'use client'

import { useBranches } from '@/hooks/use-branches'
import { usePermission } from '@/hooks/use-permission'
import { useUIStore } from '@/store/ui-store'
import { ALL_BRANCHES, type BranchScope } from '@/types'

/**
 * Which location the figures should cover: the header filter for users who can
 * see everything, and the employee's active location for everyone else.
 */
export function useBranchScope(): BranchScope {
  const { user, locationScoped, activeLocationId } = usePermission()
  const branchScope = useUIStore((state) => state.branchScope)
  if (locationScoped) return activeLocationId ?? user.branchId ?? '__none__'
  return branchScope ?? ALL_BRANCHES
}

/**
 * The branch a new document should be written against: the one in view, which
 * for a scoped user is always their own. Stock is held per branch, so a
 * document raised while looking at one branch must never default to another —
 * the units would land out of sight and the next sale would find nothing on
 * hand. With the filter on every branch there is no branch in view, so the
 * first one the user can see is offered and the form's Branch select decides.
 */
export function useDefaultBranchId(): string {
  const scope = useBranchScope()
  const { data: branches } = useBranches()
  if (scope !== ALL_BRANCHES) return scope
  return branches?.[0]?.id ?? ''
}
