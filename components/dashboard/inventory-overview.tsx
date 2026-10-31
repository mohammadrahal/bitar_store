'use client'

import { MotionSwap } from '@/components/motion/motion-swap'
import { OperationsCards } from '@/components/dashboard/operations-cards'
import { BranchStatCards, NetworkStatCards } from '@/components/dashboard/stat-cards'
import { useStockOverview } from '@/hooks/use-stock'
import type { BranchScope } from '@/types'

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

/**
 * The figures for a scope: the stat cards from `GET /stock` and the operations
 * cards from `GET /sales`. Each is its own read, so one slow answer does not
 * hold the other back.
 */
export function InventoryOverview({
  scope,
  mode,
  children,
}: {
  scope: BranchScope
  mode: 'network' | 'branch'
  /** Slot under the figures, for the overview charts. */
  children?: React.ReactNode
}) {
  const overview = useStockOverview(scope)
  const stats = overview.data?.stats

  return (
    <>
      {overview.isError ? null : (
        <MotionSwap state={stats ? 'ready' : 'loading'}>
          {stats ? (
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
