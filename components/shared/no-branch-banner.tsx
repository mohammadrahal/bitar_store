'use client'

import { usePermission } from '@/hooks/use-permission'

/** Shown to scoped roles who have not been granted a branch yet. */
export function NoBranchBanner() {
  const { branchScoped, user } = usePermission()
  if (!branchScoped || user.branchId) return null

  return (
    <div className="auth-alert" role="status">
      You do not have a branch yet. Ask your admin to assign one, then sign in again.
    </div>
  )
}
