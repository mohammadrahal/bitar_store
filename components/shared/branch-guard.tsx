'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Skeleton } from '@/components/shared/skeleton'
import { usePermission } from '@/hooks/use-permission'
import { redirectPathFor } from '@/lib/permissions'

/** Keeps branch-scoped roles on pages they are allowed to see. */
export function BranchGuard({ children }: { children: React.ReactNode }) {
  const { user } = usePermission()
  const pathname = usePathname()
  const router = useRouter()
  const redirectTo = redirectPathFor(user, pathname)

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo)
  }, [redirectTo, router])

  if (redirectTo) return <Skeleton />
  return <>{children}</>
}
