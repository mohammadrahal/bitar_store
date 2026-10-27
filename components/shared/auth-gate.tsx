'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
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
    if (user) return
    // The overview is where sign-in lands anyway, so it is not worth carrying as `next`.
    router.replace(pathname === '/dashboard' ? '/login' : `/login?next=${encodeURIComponent(pathname)}`)
  }, [user, pathname, router])

  // Nothing of the app is drawn for a signed-out visitor, not even its skeleton.
  if (!user) return null

  return <>{children}</>
}
