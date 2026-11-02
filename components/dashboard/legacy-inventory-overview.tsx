'use client'

import { MotionSwap } from '@/components/motion/motion-swap'
import { OperationsCards } from '@/components/dashboard/operations-cards'
import { BranchStatCards, NetworkStatCards } from '@/components/dashboard/stat-cards'
import { useStockOverview } from '@/hooks/use-stock'
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

/** Paged `GET /stock` stat cards and per-branch `GET /sales` for today. */
export function LegacyInventoryOverview({
  scope,
  mode,
  children,
}: {
  scope: BranchScope
  mode: 'network' | 'branch'
  children?: React.ReactNode
}) {
  const overview = useStockOverview(scope)
  const stats = overview.data?.stats

  return (
    <>
      {overview.isError ? null : (
        <MotionSwap state={stats ? 'ready' : 'loading'}>
          {stats && !overview.isPending ? (
            mode === 'network' ? <NetworkStatCards stats={stats} /> : <BranchStatCards stats={stats} />
          ) : (
            <StatCardsSkeleton />
          )}
        </MotionSwap>
      )}

      <OperationsCards scope={scope} />

      {children}
    </>
  )
}
