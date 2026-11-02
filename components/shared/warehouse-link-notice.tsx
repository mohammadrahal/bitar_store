'use client'

import { WAREHOUSE_NOT_LINKED_HINT } from '@/lib/warehouse-messages'

/** Inline help when replenishment or opening stock needs a warehouse id this device does not know yet. */
export function WarehouseLinkNotice({
  onRetry,
  retryLabel = 'Link warehouse again',
}: {
  onRetry?: () => void
  retryLabel?: string
}) {
  return (
    <div className="auth-alert replenishment-warehouse-banner" role="status">
      <p>
        <strong>Warehouse not linked on this device yet.</strong> {WAREHOUSE_NOT_LINKED_HINT}
      </p>
      {onRetry && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  )
}
