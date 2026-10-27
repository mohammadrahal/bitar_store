'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { homePathFor } from '@/lib/permissions'
import { useSession } from '@/store/user-store'

/** `/` has no page of its own: signed-out visitors go to sign in, everyone else to their home. */
export function RootRedirect() {
  const user = useSession()
  const router = useRouter()

  useEffect(() => {
    router.replace(user ? homePathFor(user) : '/login')
  }, [user, router])

  return null
}
