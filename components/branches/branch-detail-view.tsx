'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { OverviewBody } from '@/components/dashboard/overview-body'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { BranchStockPanel } from '@/components/stock/branch-stock-panel'
import { WarehouseDetailBody } from '@/components/warehouse/warehouse-detail-body'
import { Can } from '@/components/shared/can'
import { ErrorState } from '@/components/shared/error-state'
import { FadeIn } from '@/components/motion/fade-in'
import { PageHeader, WelcomeTitle } from '@/components/shared/page-header'
import { ActiveStatusPill } from '@/components/shared/status-pill'
import { Skeleton } from '@/components/shared/skeleton'
import { useBranch } from '@/hooks/use-branches'
import { branchSlug } from '@/lib/branch-slug'
import { adminHubHref } from '@/lib/admin-hub'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { usePermission } from '@/hooks/use-permission'
import { useCurrentUser } from '@/store/user-store'
import { RangeFilter } from '@/components/dashboard/range-filter'
import { DEFAULT_RANGE, type RangeDays } from '@/lib/dashboard-range'

export function BranchDetailView({ slug }: { slug: string }) {
  const user = useCurrentUser()
  const router = useRouter()
  const { data: branch, isPending, isError, error, refetch } = useBranch(slug)
  const [days, setDays] = useState<RangeDays>(DEFAULT_RANGE)
  const { canViewFinancialReports, canViewBranchSalesTelemetry } = usePermission()
  useDocumentTitle(branch?.name)

  /* Arriving by id. an old link, or a redirect built from the session, which
     only knows ids. lands on the same page, and the address is replaced with
     the readable one. */
  const canonical = branch ? branchSlug(branch) : null
  useEffect(() => {
    if (canonical && canonical !== slug) router.replace(`/branches/${canonical}`)
  }, [canonical, slug, router])

  if (isPending) return <Skeleton rows={1} />
  if (isError) return <ErrorState title="Branch unavailable" error={error} onRetry={() => void refetch()} />

  const isOwnBranch = user.branchId === branch.id
  /* The warehouse is a different kind of place and reads differently: it holds
     the stock, supplies the branches and never sells, so the trading bands
     below are replaced rather than left to report zero takings. */
  const isWarehouse = branch.kind === 'warehouse'

  return (
    <>
      <PageHeader
        eyebrow={isWarehouse ? 'Warehouse' : isOwnBranch ? `Branch · ${branch.name}` : 'Branch'}
        title={
          isOwnBranch && !isWarehouse ? (
            <WelcomeTitle name={user.name.trim().split(/\s+/)[0] || user.name} />
          ) : (
            branch.name
          )
        }
        description={
          isWarehouse
            ? 'The main inventory. Deliveries arrive here and the branches are supplied from it by transfer.'
            : isOwnBranch
              ? `Trade and stock at ${branch.name}.`
              : [branch.code ?? branch.location, branch.phone].filter(Boolean).join(' · ')
        }
        actions={
          !isWarehouse && (canViewFinancialReports() || canViewBranchSalesTelemetry(branch.id)) ? (
            <RangeFilter value={days} onChange={setDays} />
          ) : undefined
        }
      />
      {!isWarehouse ? (
        <FadeIn className="branch-page-toolbar">
          <ActiveStatusPill isActive={branch.isActive} />
          <div className="branch-page-toolbar-actions">
            {isOwnBranch ? <QuickActions /> : null}
            <Can permission="locations.view_all">
              <Link href={adminHubHref('locations')} className="btn btn-secondary btn-sm">
                <ArrowLeft size={16} aria-hidden="true" />
                All branches
              </Link>
            </Can>
          </div>
        </FadeIn>
      ) : null}
      {isWarehouse ? (
        /* Stock in, stock out, the paperwork for both, and what is on the
           shelves. It ends with its own stock panel, so none is added here. */
        <WarehouseDetailBody warehouseId={branch.id} />
      ) : (
        <>
          {/* The same bands as the network overview, narrowed to this location, so
              a branch manager and the owner read the figures the same way. */}
          <OverviewBody scope={branch.id} days={days} />
          <BranchStockPanel branchId={branch.id} />
        </>
      )}
    </>
  )
}
