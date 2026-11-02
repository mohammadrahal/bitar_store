'use client'

import { MotionSwap } from '@/components/motion/motion-swap'
import { OperationsCards } from '@/components/dashboard/operations-cards'
import { BranchStatCards, NetworkStatCards } from '@/components/dashboard/stat-cards'
import { useDashboardOverview } from '@/hooks/use-dashboard-overview'
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

/** Stat cards + today from `GET /dashboard/overview` only — no catalog or paged stock. */
export function FinancialInventoryOverview({
  scope,
  mode,
  children,
}: {
  scope: BranchScope
  mode: 'network' | 'branch'
  children?: React.ReactNode
}) {
  const dashboard = useDashboardOverview(scope)
  const stats = dashboard.data?.stats

  return (
    <>
      {dashboard.isError ? null : (
        <MotionSwap state={stats ? 'ready' : 'loading'}>
          {stats && !dashboard.isPending ? (
            mode === 'network' ? <NetworkStatCards stats={stats} /> : <BranchStatCards stats={stats} />
          ) : (
            <StatCardsSkeleton />
          )}
        </MotionSwap>
      )}

      <OperationsCards
        scope={scope}
        prefetched={dashboard.data?.operations}
        fromDashboardOverview
        dashboardPending={dashboard.isPending}
        dashboardFailed={dashboard.isError}
      />

      {children}
    </>
  )
}
