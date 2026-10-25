'use client'

import { usePermission } from '@/hooks/use-permission'
import { useUIStore } from '@/store/ui-store'
import { ALL_BRANCHES, type BranchScope } from '@/types'

/**
 * Which branch the dashboard figures should cover: the header filter for users
 * who can see everything, and the user's own branch for everyone else.
 */
export function useBranchScope(): BranchScope {
  const { user, branchScoped } = usePermission()
  const branchScope = useUIStore((state) => state.branchScope)
  if (branchScoped && user.branchId) return user.branchId
  return branchScope ?? ALL_BRANCHES
}
