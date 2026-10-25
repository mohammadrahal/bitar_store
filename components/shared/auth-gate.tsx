'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Skeleton } from '@/components/shared/skeleton'
import { useSession } from '@/store/user-store'

/**
 * Keeps the app behind a session. Signed-out visitors are sent to the login
 * screen with the path they wanted, so they land there once signed in.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const user = useSession()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!user) router.replace(`/login?next=${encodeURIComponent(pathname)}`)
  }, [user, pathname, router])

  if (!user) {
    return (
      <main className="page-content">
        <Skeleton />
      </main>
    )
  }

  return <>{children}</>
}
