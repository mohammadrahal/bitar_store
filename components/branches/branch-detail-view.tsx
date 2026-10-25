'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { InventoryOverview } from '@/components/dashboard/inventory-overview'
import { SalesCharts } from '@/components/dashboard/sales-charts'
import { Can } from '@/components/shared/can'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { ActiveStatusPill } from '@/components/shared/status-pill'
import { Skeleton } from '@/components/shared/skeleton'
import { useBranch } from '@/hooks/use-branches'
import { ALL_BRANCHES } from '@/types'

export function BranchDetailView({ branchId }: { branchId: string }) {
  const { data: branch, isPending, isError, error, refetch } = useBranch(branchId)

  if (isPending) return <Skeleton rows={1} />
  if (isError) return <ErrorState title="Branch unavailable" error={error} onRetry={() => void refetch()} />

  return (
    <>
      <PageHeader
        eyebrow="Branch"
        title={branch.name}
        description={[branch.code ?? branch.location, branch.phone].filter(Boolean).join(' · ')}
        actions={
          <>
            <ActiveStatusPill isActive={branch.isActive} />
            <Can action="branches:manage">
              <Link href="/branches" className="btn btn-secondary">
                <ArrowLeft size={16} aria-hidden="true" />
                All branches
              </Link>
            </Can>
          </>
        }
      />
      <InventoryOverview scope={branch.id} mode="branch">
        <SalesCharts scope={branch.id} heading={`Best sellers at ${branch.name}`} />

        {/* The hub answers for the whole chain, so its page also carries the
            network figures — for viewers allowed to see every branch. */}
        {branch.isMain && (
          <Can action="branches:view-all">
            <SalesCharts scope={ALL_BRANCHES} heading="Best sellers across every branch" />
          </Can>
        )}
      </InventoryOverview>
    </>
  )
}
