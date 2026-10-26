'use client'

import { useMemo } from 'react'
import { canAccessBranch, canUser, isBranchScoped, type Action } from '@/lib/permissions'
import { useCurrentUser } from '@/store/user-store'

/** Single entry point for permission checks inside components. */
export function usePermission() {
  const user = useCurrentUser()

  return useMemo(
    () => ({
      user,
      role: user.role,
      branchScoped: isBranchScoped(user),
      can: (action: Action) => canUser(user, action),
      canAccessBranch: (branchId: string) => canAccessBranch(user, branchId),
    }),
    [user],
  )
}
