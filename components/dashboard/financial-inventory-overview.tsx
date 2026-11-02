'use client'

import { useState } from 'react'
import { MotionSwap } from '@/components/motion/motion-swap'
import { OperationsTile } from '@/components/dashboard/operations-cards'
import { PerformanceOverview } from '@/components/dashboard/performance-overview'
import { BranchStatCards, NetworkStatCards } from '@/components/dashboard/stat-cards'
import { useDashboardOverview } from '@/hooks/use-dashboard-overview'
import { DEFAULT_RANGE, type RangeDays } from '@/lib/dashboard-range'
import type { BranchScope } from '@/types'

function StatCardsSkeleton() {
  return (
    <div className="stats-grid" aria-busy="true">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="skeleton skeleton-card" />
      ))}
    </div>
  )
}

/**
 * The overview for anyone who may see money. It leads with performance over a
 * chosen window — revenue, sales, and the two stock counts that need acting on
 * — then the standing figures for the catalog, then whatever the page nests
 * inside it (today's best sellers, a branch's stock).
 *
 * Stats and today come from one `GET /dashboard/overview`; the window comes
 * from `GET /reports/sales-summary`, which is the only endpoint that returns a
 * figure per day.
 */
export function FinancialInventoryOverview({
  scope,
  mode,
  children,
}: {
  scope: BranchScope
  mode: 'network' | 'branch'
  children?: React.ReactNode
}) {
  const [days, setDays] = useState<RangeDays>(DEFAULT_RANGE)
  const dashboard = useDashboardOverview(scope)
  const stats = dashboard.data?.stats

  const todayTile = (
    <OperationsTile
      scope={scope}
      prefetched={dashboard.data?.operations}
      fromDashboardOverview
      dashboardPending={dashboard.isPending}
      dashboardFailed={dashboard.isError}
    />
  )

  return (
    <>
      <PerformanceOverview
        scope={scope}
        days={days}
        onDaysChange={setDays}
        lowStock={dashboard.data?.lowStock}
        outOfStock={dashboard.data?.outOfStock}
      />

      <div className="section-bar">
        <h2 className="section-title">Catalog and today</h2>
      </div>

      {dashboard.isError ? null : (
        <MotionSwap state={stats ? 'ready' : 'loading'}>
          {stats && !dashboard.isPending ? (
            mode === 'network' ? (
              <NetworkStatCards stats={stats} leading={todayTile} />
            ) : (
              <BranchStatCards stats={stats} leading={todayTile} />
            )
          ) : (
            <StatCardsSkeleton />
          )}
        </MotionSwap>
      )}

      {children}
    </>
  )
}
