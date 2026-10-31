'use client'

import { Eye } from 'lucide-react'
import { usePermission } from '@/hooks/use-permission'

/**
 * A view-only assignment shows that location's stock and nothing else, so the
 * screens that record something say why they are closed rather than failing on
 * submit. Renders nothing when the location may be acted on.
 */
export function ViewOnlyNotice({ locationId, action }: { locationId: string; action: string }) {
  const { isViewOnlyAt } = usePermission()
  if (!locationId || !isViewOnlyAt(locationId)) return null

  return (
    <p className="auth-alert" role="status">
      <Eye size={14} aria-hidden="true" /> You have view-only access at this location, so you can see its stock but
      cannot {action} here. Ask a manager for full access, or switch location in the header.
    </p>
  )
}
