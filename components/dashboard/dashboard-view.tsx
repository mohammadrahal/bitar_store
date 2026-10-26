'use client'

import { InventoryOverview } from '@/components/dashboard/inventory-overview'
import { SalesCharts } from '@/components/dashboard/sales-charts'
import { PageHeader } from '@/components/shared/page-header'
import { useBranches } from '@/hooks/use-branches'
import { useBranchScope } from '@/hooks/use-branch-scope'
import { useCurrentUser } from '@/store/user-store'
import { ALL_BRANCHES } from '@/types'

export function DashboardView() {
  const user = useCurrentUser()
  const scope = useBranchScope()
  const { data: branches } = useBranches()
  const scopedBranch = scope === ALL_BRANCHES ? null : branches?.find((branch) => branch.id === scope)

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title={`Welcome back, ${user.name}`}
        description={
          scopedBranch
            ? `Stock health at ${scopedBranch.name}. Use the header filter to widen the scope.`
            : 'Stock health across every branch, with the items that need attention first.'
        }
      />
      <InventoryOverview scope={scope} mode="network">
        <SalesCharts scope={scope} />
      </InventoryOverview>
    </>
  )
}
