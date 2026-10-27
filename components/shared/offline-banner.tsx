'use client'

import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/use-online-status'

/** Posting needs the server, so when the network drops staff are told to fall back to paper. */
export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null
  return (
    <div className="offline-banner" role="alert">
      <WifiOff size={16} aria-hidden="true" />
      You are offline. Posting is unavailable, so record sales and receipts manually until the connection is back.
    </div>
  )
}
