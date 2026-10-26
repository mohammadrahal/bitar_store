'use client'

import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/shared/skeleton'
import { ApiError } from '@/lib/api'
import { bootstrapSession } from '@/services/session.service'
import { useUIStore } from '@/store/ui-store'
import { clearLegacySessionStorage, useUserStore } from '@/store/user-store'

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
    void Promise.all([useUserStore.persist.rehydrate(), useUIStore.persist.rehydrate()]).then(async () => {
      const { token, user, setUser, signOut } = useUserStore.getState()
      if (token) {
        try {
          setUser(await bootstrapSession(token))
        } catch (error) {
          /* A network blip keeps the cached session; a rejected token does not. */
          if (!user || (error instanceof ApiError && error.status === 401)) signOut()
        }
      }
      setHydrated(true)
    })
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
