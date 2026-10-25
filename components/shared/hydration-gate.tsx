'use client'

import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/shared/skeleton'
import { bootstrapSession } from '@/services/session.service'
import { useUIStore } from '@/store/ui-store'
import { migrateUserSessionStorage, useUserStore } from '@/store/user-store'

/**
 * The user session uses sessionStorage; UI preferences use localStorage. Both
 * rehydrate after mount so markup matches what the client will show.
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
    migrateUserSessionStorage()
    void Promise.all([useUserStore.persist.rehydrate(), useUIStore.persist.rehydrate()]).then(async () => {
      const { userId, user, signIn, signOut } = useUserStore.getState()
      if (userId && !user) {
        try {
          const session = await bootstrapSession(userId)
          signIn(session)
        } catch {
          signOut()
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
