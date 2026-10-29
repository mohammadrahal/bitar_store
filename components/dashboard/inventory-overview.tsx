'use client'

import { useEffect, useState } from 'react'
import { LowStockTable } from '@/components/dashboard/low-stock-table'
import { OperationsCards } from '@/components/dashboard/operations-cards'
import { BranchStatCards, NetworkStatCards } from '@/components/dashboard/stat-cards'
import { ErrorState } from '@/components/shared/error-state'
import { Pagination } from '@/components/shared/pagination'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useStockOverview } from '@/hooks/use-stock'
import { ALL_BRANCHES, type BranchScope } from '@/types'

const PAGE_SIZE = 10

/** Placeholders that hold the figures' space while they load. */
function StatCardsSkeleton() {
  return (
    <div className="stats-grid" aria-busy="true">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="skeleton skeleton-card" />
      ))}
    </div>
  )
}

function attentionDescription(isPending: boolean, isError: boolean, count: number): string {
  if (isError) return 'These figures could not be loaded.'
  if (isPending) return 'Checking stock against each threshold.'
  if (count === 0) return 'Every variant is above its low-stock threshold.'
  return `${count} ${count === 1 ? 'variant' : 'variants'} at or below the threshold, emptiest first.`
}

/**
 * Stat cards plus the low-stock table, shared by the overview and a single
 * branch page. The figures, the operations cards and the charts are three
 * separate reads, so each carries its own loading state instead of one
 * skeleton holding back all three.
 */
export function InventoryOverview({
  scope,
  mode,
  children,
}: {
  scope: BranchScope
  mode: 'network' | 'branch'
  /** Slot between the figures and the attention list, for the overview charts. */
  children?: React.ReactNode
}) {
  const overview = useStockOverview(scope)
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [scope])

  const stats = overview.data?.stats
  const rows = overview.data?.lowStock ?? []
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <>
      {stats ? (
        mode === 'network' ? <NetworkStatCards stats={stats} /> : <BranchStatCards stats={stats} />
      ) : overview.isError ? null : (
        <StatCardsSkeleton />
      )}

      <OperationsCards scope={scope} />

      {children}

      <Panel
        title="Needs attention"
        description={attentionDescription(overview.isPending, overview.isError, rows.length)}
      >
        {overview.isError ? (
          <div className="panel-body">
            <ErrorState
              title="Could not load stock figures"
              error={overview.error}
              onRetry={() => void overview.refetch()}
            />
          </div>
        ) : overview.isPending ? (
          <div className="panel-body">
            <Skeleton rows={3} stats={0} />
          </div>
        ) : (
          <>
            <LowStockTable rows={visible} showBranch={mode === 'network' && scope === ALL_BRANCHES} />
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              total={rows.length}
              pageSize={PAGE_SIZE}
              onPage={setPage}
            />
          </>
        )}
      </Panel>
    </>
  )
}
