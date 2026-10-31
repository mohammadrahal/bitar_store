'use client'

import { usePermission } from '@/hooks/use-permission'

/** Shown to employees who have not been assigned a location yet. */
export function NoBranchBanner() {
  const { locationScoped, user } = usePermission()
  if (!locationScoped || user.locations.length > 0) return null

  return (
    <div className="auth-alert" role="status">
      You have no location yet. Ask a manager to assign one, then sign in again.
    </div>
  )
}
