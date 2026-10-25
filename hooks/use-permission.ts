'use client'

import { useMemo } from 'react'
import { can, canAccessBranch, isBranchScoped, type Action } from '@/lib/permissions'
import { useCurrentUser } from '@/store/user-store'

/** Single entry point for permission checks inside components. */
export function usePermission() {
  const user = useCurrentUser()

  return useMemo(
    () => ({
      user,
      role: user.role,
      branchScoped: isBranchScoped(user),
      can: (action: Action) => can(user.role, action),
      canAccessBranch: (branchId: string) => canAccessBranch(user, branchId),
    }),
    [user],
  )
}
