'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Skeleton } from '@/components/shared/skeleton'
import { useBranches } from '@/hooks/use-branches'
import { usePermission } from '@/hooks/use-permission'
import { isBranchId, matchesBranchSlug } from '@/lib/branch-slug'
import { homePathFor, redirectPathFor } from '@/lib/permissions'

/** Keeps branch-scoped roles on pages they are allowed to see. */
export function BranchGuard({ children }: { children: React.ReactNode }) {
  const { user, canAccessLocation } = usePermission()
  const { data: branches } = useBranches()
  const pathname = usePathname()
  const router = useRouter()

  /* `/branches/<code>` is only a location this user may open once the branch
     list says which one it is; until then the page shows nothing of it. */
  const segment = /^\/branches\/([^/]+)/.exec(pathname)?.[1]
  const named =
    segment && !isBranchId(segment) ? branches?.find((branch) => matchesBranchSlug(branch, segment)) : undefined
  const forbidden = named !== undefined && !canAccessLocation(named.id)
  const redirectTo = redirectPathFor(user, pathname) ?? (forbidden ? homePathFor(user) : null)

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo)
  }, [redirectTo, router])

  if (redirectTo) return <Skeleton />
  return <>{children}</>
}
