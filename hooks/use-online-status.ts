'use client'

import { useSyncExternalStore } from 'react'
import { useOffline } from 'next/offline'

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/**
 * Whether the app can currently reach the server.
 *
 * `navigator.onLine` alone is not enough: it answers "is there a network
 * interface up", so a tablet joined to the shop wifi with the line to the
 * street cut reports itself online and every post hangs. Next's `useOffline`
 * (enabled by `experimental.useOffline` in next.config.mjs) also flips when a
 * request fails to reach the origin, and polls to find out when it can again.
 *
 * Either signal saying offline is taken as offline, since the cost of being
 * wrong that way is a banner, and the other way is a sale that seems to post.
 */
export function useOnlineStatus() {
  const frameworkOffline = useOffline()
  const interfaceUp = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  )
  return interfaceUp && !frameworkOffline
}
