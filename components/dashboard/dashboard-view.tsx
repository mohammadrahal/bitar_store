'use client'

import { useState } from 'react'
import { OverviewBody } from '@/components/dashboard/overview-body'
import { RangeFilter } from '@/components/dashboard/range-filter'
import { PageHeader, WelcomeTitle } from '@/components/shared/page-header'
import { useBranches } from '@/hooks/use-branches'
import { useBranchScope } from '@/hooks/use-branch-scope'
import { usePermission } from '@/hooks/use-permission'
import { DEFAULT_RANGE, type RangeDays } from '@/lib/dashboard-range'
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
  const [days, setDays] = useState<RangeDays>(DEFAULT_RANGE)
  const { canViewFinancialReports, canViewNetworkSalesTelemetry } = usePermission()
  const showRange = canViewFinancialReports() || canViewNetworkSalesTelemetry()

  return (
    <>
      <PageHeader
        title={<WelcomeTitle name={firstName(user.name)} />}
        description={
          scopedBranch
            ? `Trade and stock at ${scopedBranch.name}.`
            : 'Trade and stock across every location, with what needs attention first.'
        }
        actions={showRange ? <RangeFilter value={days} onChange={setDays} /> : undefined}
      />
      <OverviewBody scope={scope} days={days} />
    </>
  )
}
