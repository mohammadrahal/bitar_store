'use client'

import { WifiOff } from 'lucide-react'
import { useDataAsOf } from '@/hooks/use-data-as-of'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { formatRelativeDateTime } from '@/lib/format'

/**
 * What offline means now that the figures are kept on the device: everything
 * on screen is readable and printable, but it is a snapshot, and nothing can
 * be posted until the connection is back.
 *
 * The timestamp is the point: a stock figure with no age on it is worse than
 * no figure, because staff will act on it as though it were live.
 */
export function OfflineBanner() {
  const online = useOnlineStatus()
  const asOf = useDataAsOf()

  if (online) return null

  return (
    <div className="offline-banner" role="status">
      <WifiOff size={16} aria-hidden="true" />
      <span>
        You are offline{asOf === null ? '' : `, showing figures from ${formatRelativeDateTime(asOf)}`}.
        Sales and receipts cannot be posted until the connection is back.
      </span>
    </div>
  )
}
