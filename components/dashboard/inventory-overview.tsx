'use client'

import { useEffect, useState } from 'react'
import { LowStockTable } from '@/components/dashboard/low-stock-table'
import { OperationsCards } from '@/components/dashboard/operations-cards'
import { BranchStatCards, NetworkStatCards } from '@/components/dashboard/stat-cards'
import { ErrorState } from '@/components/shared/error-state'
import { Pagination } from '@/components/shared/pagination'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useInventoryStats, useLowStock } from '@/hooks/use-stock'
import { ALL_BRANCHES, type BranchScope } from '@/types'

const PAGE_SIZE = 10

/** Stat cards plus the low-stock table, shared by the overview and a single branch page. */
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
  const stats = useInventoryStats(scope)
  const lowStock = useLowStock(scope)
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [scope])

  if (stats.isPending || lowStock.isPending) return <Skeleton rows={1} />

  if (stats.isError || lowStock.isError) {
    return (
      <Panel title="Inventory">
        <div className="panel-body">
          <ErrorState
            title="Could not load stock figures"
            error={stats.error ?? lowStock.error}
            onRetry={() => {
              void stats.refetch()
              void lowStock.refetch()
            }}
          />
        </div>
      </Panel>
    )
  }

  const rows = lowStock.data
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <>
      {mode === 'network' ? <NetworkStatCards stats={stats.data} /> : <BranchStatCards stats={stats.data} />}
      <OperationsCards scope={scope} />

      {children}

      <Panel
        title="Needs attention"
        description={
          rows.length === 0
            ? 'Every variant is above its low-stock threshold.'
            : `${rows.length} ${rows.length === 1 ? 'variant' : 'variants'} at or below the threshold, emptiest first.`
        }
      >
        <LowStockTable rows={visible} showBranch={mode === 'network' && scope === ALL_BRANCHES} />
        <Pagination
          page={currentPage}
          pageCount={pageCount}
          total={rows.length}
          pageSize={PAGE_SIZE}
          onPage={setPage}
        />
      </Panel>
    </>
  )
}
