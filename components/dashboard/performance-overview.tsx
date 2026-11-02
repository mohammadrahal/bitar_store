'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { AlertTriangle, PackageX, Receipt, ShoppingBag } from 'lucide-react'
import { RangeFilter } from '@/components/dashboard/range-filter'
import { RevenueSplits } from '@/components/dashboard/revenue-split'
import { StatCard, countOf } from '@/components/dashboard/stat-cards'
import { StaggerList } from '@/components/motion/stagger'
import { ErrorState } from '@/components/shared/error-state'
import { Panel } from '@/components/shared/panel'
import { RevenueTrendTable } from '@/components/dashboard/revenue-trend-table'
import { useDashboardTrend, useTrendComparison } from '@/hooks/use-dashboard-trend'
import { usePermission } from '@/hooks/use-permission'
import { REVENUE_TREND_HEIGHT } from '@/lib/chart-geometry'
import { deltaOf, type RangeDays } from '@/lib/dashboard-range'
import { formatNumber, formatPrice } from '@/lib/format'
import { inventoryHref } from '@/lib/inventory-filters'
import type { BranchScope } from '@/types'

/* Same reasoning as the other two charts: recharts stays out of the first load
   and arrives once there are figures to draw. */
const RevenueTrendChart = dynamic(
  () => import('@/components/dashboard/revenue-trend-chart').then((mod) => ({ default: mod.RevenueTrendChart })),
  {
    ssr: false,
    loading: () => <div className="chart-placeholder skeleton" aria-hidden="true" />,
  },
)

function TilesSkeleton() {
  return (
    <div className="stats-grid" aria-busy="true">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="skeleton skeleton-card" />
      ))}
    </div>
  )
}

/**
 * The range-scoped half of the overview: what the business took over the chosen
 * window, how that compares with the window before it, and what needs attention
 * in stock right now.
 *
 * The range control scopes every figure in this section and nothing outside it.
 * The two stock tiles are deliberately point-in-time — a count of what is low or
 * empty on the shelf has no meaning "over 30 days" — so they say "right now" on
 * their face rather than letting the filter above imply otherwise.
 */
export function PerformanceOverview({
  scope,
  days,
  onDaysChange,
  lowStock,
  outOfStock,
}: {
  scope: BranchScope
  days: RangeDays
  onDaysChange: (days: RangeDays) => void
  lowStock?: number
  outOfStock?: number
}) {
  const trend = useDashboardTrend(scope, days)
  const previous = useTrendComparison(scope, days)
  const { canManageMinimums } = usePermission()
  const [view, setView] = useState<'chart' | 'numbers'>('chart')
  /* The inventory screen has no low-stock filter — "what is under its minimum"
     is the replenishment screen's whole subject — so the tile goes there, and
     goes nowhere for a viewer who cannot open it. */
  const lowStockHref = canManageMinimums() ? '/replenishment' : undefined

  const since = `vs prev ${days} days`
  const revenueDelta = trend.data && previous.data ? deltaOf(trend.data.revenue, previous.data.revenue) : null
  const salesDelta = trend.data && previous.data ? deltaOf(trend.data.sales, previous.data.sales) : null

  return (
    <section className="performance" aria-label={`Performance, last ${days} days`}>
      <div className="section-bar">
        <h2 className="section-title">Performance</h2>
        <RangeFilter value={days} onChange={onDaysChange} />
      </div>

      {/* The two stock counts come from a different endpoint to the window, so
          they are rendered whether or not the sales figures arrived: a failing
          report should not also hide what is empty on the shelf. */}
      {!trend.data && !trend.isError ? (
        <TilesSkeleton />
      ) : (
        <div className={`performance-body ${trend.isPlaceholderData ? 'is-refetching' : ''}`}>
          <StaggerList className="stats-grid">
            <StatCard
              label="Revenue"
              value={trend.data ? formatPrice(trend.data.revenue) : '—'}
              detail={trend.data ? `Over the last ${days} days` : 'Figures unavailable'}
              icon={Receipt}
              delta={revenueDelta}
              deltaSince={since}
            />
            <StatCard
              label="Sales"
              value={trend.data ? formatNumber(trend.data.sales) : '—'}
              detail={trend.data ? countOf(trend.data.items, 'item') : 'Figures unavailable'}
              icon={ShoppingBag}
              delta={salesDelta}
              deltaSince={since}
              href="/sales/b2c"
            />
            <StatCard
              label="Low stock"
              value={lowStock === undefined ? '—' : formatNumber(lowStock)}
              detail="At or under its minimum, right now"
              alert={Boolean(lowStock)}
              icon={AlertTriangle}
              href={lowStockHref}
            />
            <StatCard
              label="Out of stock"
              value={outOfStock === undefined ? '—' : formatNumber(outOfStock)}
              detail="Nothing on hand, right now"
              alert={Boolean(outOfStock)}
              icon={PackageX}
              href={inventoryHref('out')}
            />
          </StaggerList>

          {trend.isError ? (
            <Panel title={`Last ${days} days`} headingLevel={3}>
              <div className="panel-body">
                <ErrorState
                  title="Could not load sales figures"
                  error={trend.error}
                  onRetry={() => void trend.refetch()}
                />
              </div>
            </Panel>
          ) : trend.data ? (
            <div className="trend-grid">
              <Panel
                title="Revenue by day"
                headingLevel={3}
                description={`${formatPrice(trend.data.revenue)} over the last ${days} days.`}
                actions={
                  <div className="segmented compact" role="radiogroup" aria-label="Show revenue as">
                    {(['chart', 'numbers'] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={view === option}
                        className={view === option ? 'active' : ''}
                        onClick={() => setView(option)}
                      >
                        {option === 'chart' ? 'Chart' : 'Numbers'}
                      </button>
                    ))}
                  </div>
                }
              >
                {view === 'chart' ? (
                  <div className="panel-body">
                    <div className="chart-slot" style={{ minHeight: REVENUE_TREND_HEIGHT }}>
                      <RevenueTrendChart points={trend.data.points} />
                    </div>
                  </div>
                ) : (
                  <RevenueTrendTable points={trend.data.points} />
                )}
              </Panel>

              <Panel
                title="Revenue mix"
                headingLevel={3}
                description={`How the last ${days} days were paid and where they came from.`}
              >
                <div className="panel-body">
                  <RevenueSplits splits={trend.data.splits} />
                </div>
              </Panel>
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}
