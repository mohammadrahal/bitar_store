'use client'

import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/shared/skeleton'
import { isUnauthorized } from '@/lib/errors'
import { ensureLocalMockDataPurged } from '@/lib/purge-local-mock-data'
import { bootstrapSession } from '@/services/session.service'
import { warmWarehouseLink } from '@/services/warehouse-link.service'
import { useUIStore } from '@/store/ui-store'
import { clearLegacySessionStorage, useUserStore } from '@/store/user-store'

/** How long a focused tab trusts the user it already has. */
const FOCUS_REFRESH_MS = 60_000

/**
 * The session uses sessionStorage; UI preferences use localStorage. Both
 * rehydrate after mount so markup matches what the client will show. A saved
 * token is re-checked with `GET /auth/me` so role and branch access are fresh.
 */
export function HydrationGate({
  children,
  fallback,
}: {
  children: React.ReactNode
  /** Shown while rehydrating; defaults to the dashboard skeleton. */
  fallback?: React.ReactNode
}) {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    clearLegacySessionStorage()
    void ensureLocalMockDataPurged().then(() =>
      Promise.all([useUserStore.persist.rehydrate(), useUIStore.persist.rehydrate()]).then(async () => {
      const { token, user, setUser, signOut } = useUserStore.getState()
      if (token) {
        try {
          const fresh = await bootstrapSession(token)
          setUser(fresh)
          warmWarehouseLink(fresh)
        } catch (error) {
          /* A network blip keeps the cached session; a rejected token does not. */
          if (!user || isUnauthorized(error)) signOut()
        }
      }
      setHydrated(true)
      }),
    )
  }, [])

  /* Permission changes from an admin apply on the server immediately; refresh
     the cached user when this tab is focused so transfer buttons match.

     Throttled, because `focus` fires on every return to the tab — clicking back
     from a terminal or another window counts — and each run is a `GET /auth/me`
     plus whatever `warmWarehouseLink` needs. An admin editing someone's
     permissions is not a once-a-second event, so a minute between reads is
     still far faster than that person notices. */
  useEffect(() => {
    let lastRefreshedAt = Date.now()
    const refresh = () => {
      const { token, setUser } = useUserStore.getState()
      if (!token) return
      if (document.visibilityState === 'hidden') return
      if (Date.now() - lastRefreshedAt < FOCUS_REFRESH_MS) return
      lastRefreshedAt = Date.now()
      void bootstrapSession(token)
        .then((fresh) => {
          setUser(fresh)
          warmWarehouseLink(fresh)
        })
        .catch(() => {})
    }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])

  if (!hydrated) {
    if (fallback !== undefined) return <>{fallback}</>
    return (
      <main className="page-content">
        <Skeleton />
      </main>
    )
  }

  return <>{children}</>
}
