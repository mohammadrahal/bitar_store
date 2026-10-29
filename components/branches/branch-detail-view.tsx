'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { InventoryOverview } from '@/components/dashboard/inventory-overview'
import { SalesCharts } from '@/components/dashboard/sales-charts'
import { BranchStockPanel } from '@/components/stock/branch-stock-panel'
import { Can } from '@/components/shared/can'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { ActiveStatusPill } from '@/components/shared/status-pill'
import { Skeleton } from '@/components/shared/skeleton'
import { useBranch } from '@/hooks/use-branches'
import { useCurrentUser } from '@/store/user-store'

export function BranchDetailView({ branchId }: { branchId: string }) {
  const user = useCurrentUser()
  const { data: branch, isPending, isError, error, refetch } = useBranch(branchId)

  if (isPending) return <Skeleton rows={1} />
  if (isError) return <ErrorState title="Branch unavailable" error={error} onRetry={() => void refetch()} />

  const isOwnBranch = user.branchId === branch.id

  return (
    <>
      <PageHeader
        eyebrow={isOwnBranch ? `Branch · ${branch.name}` : 'Branch'}
        title={isOwnBranch ? `Welcome back, ${user.name}` : branch.name}
        description={
          isOwnBranch ? undefined : [branch.code ?? branch.location, branch.phone].filter(Boolean).join(' · ')
        }
        actions={
          <>
            <ActiveStatusPill isActive={branch.isActive} />
            <Can permission="locations.view_all">
              <Link href="/branches" className="btn btn-secondary">
                <ArrowLeft size={16} aria-hidden="true" />
                All branches
              </Link>
            </Can>
          </>
        }
      />
      <InventoryOverview scope={branch.id} mode="branch">
        <BranchStockPanel branchId={branch.id} />

        <SalesCharts scope={branch.id} heading={`Best sellers at ${branch.name}`} />
      </InventoryOverview>
    </>
  )
}
