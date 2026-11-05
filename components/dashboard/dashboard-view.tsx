'use client'

import { OverviewBody } from '@/components/dashboard/overview-body'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { PageHeader } from '@/components/shared/page-header'
import { useBranches } from '@/hooks/use-branches'
import { useBranchScope } from '@/hooks/use-branch-scope'
import { useCurrentUser } from '@/store/user-store'
import { ALL_BRANCHES } from '@/types'

/** "Nadia Bitar" -> "Nadia". A greeting uses the name someone is called by. */
function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name
}

export function DashboardView() {
  const user = useCurrentUser()
  const scope = useBranchScope()
  const { data: branches } = useBranches()
  const scopedBranch = scope === ALL_BRANCHES ? null : branches?.find((branch) => branch.id === scope)

  return (
    <>
      <PageHeader
        title={`Welcome back, ${firstName(user.name)}`}
        description={
          scopedBranch
            ? `Trade and stock at ${scopedBranch.name}.`
            : 'Trade and stock across every location, with what needs attention first.'
        }
        actions={<QuickActions />}
      />
      <OverviewBody scope={scope} />
    </>
  )
}
