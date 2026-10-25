'use client'

import { usePermission } from '@/hooks/use-permission'
import type { Action } from '@/lib/permissions'

/**
 * Renders children only when the current role may perform `action`.
 * Pass `branchId` to also require access to that specific branch.
 */
export function Can({
  action,
  branchId,
  fallback = null,
  children,
}: {
  action: Action
  branchId?: string
  fallback?: React.ReactNode
  children: React.ReactNode
}) {
  const { can, canAccessBranch } = usePermission()
  const allowed = can(action) && (branchId === undefined || canAccessBranch(branchId))
  return <>{allowed ? children : fallback}</>
}
