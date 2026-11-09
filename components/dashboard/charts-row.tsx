'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { RevenueSplits } from '@/components/dashboard/revenue-split'
import { RevenueTrendTable } from '@/components/dashboard/revenue-trend-table'
import { ErrorState } from '@/components/shared/error-state'
import { Panel } from '@/components/shared/panel'
import { useDashboardTrend } from '@/hooks/use-dashboard-trend'
import { usePermission } from '@/hooks/use-permission'
import { REVENUE_TREND_HEIGHT } from '@/lib/chart-geometry'
import { formatPrice } from '@/lib/format'
import type { RangeDays } from '@/lib/dashboard-range'
import type { BranchScope } from '@/types'

/* recharts is ~360 KB and nothing above the fold needs it, so it stays out of
   the first load and arrives once there are figures to draw. The placeholder
   reserves the chart's height so the panel does not jump when it lands. */
const RevenueTrendChart = dynamic(
  () => import('@/components/dashboard/revenue-trend-chart').then((mod) => ({ default: mod.RevenueTrendChart })),
  { ssr: false, loading: () => <div className="chart-placeholder skeleton" aria-hidden="true" /> },
)

/**
 * Revenue by day beside how that revenue split. The trend is the subject and
 * takes two thirds of the row; the mix is the aside that qualifies it.
 */
export function ChartsRow({ scope, days }: { scope: BranchScope; days: RangeDays }) {
  const trend = useDashboardTrend(scope, days)
  const [view, setView] = useState<'chart' | 'numbers'>('chart')
  const { canViewFinancialReports } = usePermission()

  if (!canViewFinancialReports()) return null

  if (trend.isError) {
    return (
      <Panel title={`Last ${days} days`} headingLevel={3}>
        <div className="panel-body">
          <ErrorState title="Could not load sales figures" error={trend.error} onRetry={() => void trend.refetch()} />
        </div>
      </Panel>
    )
  }

  if (!trend.data) return null

  return (
    <div className={`trend-grid ${trend.isPlaceholderData ? 'is-refetching' : ''}`}>
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
          <div className="panel-body">
            <RevenueTrendTable points={trend.data.points} />
          </div>
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
  )
}
