'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { ReceiptText } from 'lucide-react'
import { TopSellersTable } from '@/components/dashboard/top-sellers-table'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useSalesAnalytics } from '@/hooks/use-analytics'
import { branchSalesChartHeight, topSellersChartHeight } from '@/lib/chart-geometry'
import { formatNumber, formatPrice } from '@/lib/format'
import type { BranchScope } from '@/types'

type View = 'chart' | 'numbers'

/**
 * recharts is ~360 KB of the dashboard's JavaScript and nothing above the fold
 * needs it, so both charts are split out and fetched once the figures arrive.
 * They render from client state only, so there is nothing for SSR to produce.
 * Each placeholder reserves the height its chart lays out to, so the panel does
 * not jump when the module lands.
 */
const ChartPlaceholder = () => <div className="chart-placeholder skeleton" aria-hidden="true" />

const TopSellersChart = dynamic(
  () => import('@/components/dashboard/top-sellers-chart').then((mod) => ({ default: mod.TopSellersChart })),
  { ssr: false, loading: ChartPlaceholder },
)

const BranchSalesChart = dynamic(
  () => import('@/components/dashboard/branch-sales-chart').then((mod) => ({ default: mod.BranchSalesChart })),
  { ssr: false, loading: ChartPlaceholder },
)

/**
 * Holds the height the chart inside it will lay out to, so the placeholder and
 * the chart occupy the same box and the panel does not jump when the module
 * lands. The placeholder is absolutely positioned against this.
 */
function ChartSlot({ height, children }: { height: number; children: React.ReactNode }) {
  return (
    <div className="chart-slot" style={{ minHeight: height }}>
      {children}
    </div>
  )
}

/**
 * Charts for what sells: top products, and how revenue sits across branches.
 * One scope per block, so a branch page can show its own figures and the main
 * branch can show the network's alongside them.
 */
export function SalesCharts({
  scope,
  heading = 'Best sellers',
}: {
  scope: BranchScope
  /** Panel title, which has to say which scope it covers when two are on a page. */
  heading?: string
}) {
  const { data, isPending, isError, error, refetch } = useSalesAnalytics(scope)
  const [view, setView] = useState<View>('chart')

  if (isPending) {
    return (
      <Panel title={heading} description="Loading…">
        <div className="panel-body">
          <Skeleton rows={1} stats={0} />
        </div>
      </Panel>
    )
  }

  if (isError) {
    return (
      <Panel title={heading}>
        <div className="panel-body">
          <ErrorState title="Could not load sales figures" error={error} onRetry={() => void refetch()} />
        </div>
      </Panel>
    )
  }

  if (data.documentCount === 0 || data.topProducts.length === 0) {
    return (
      <Panel title={heading}>
        <div className="panel-body">
          <EmptyState
            icon={ReceiptText}
            title="No sales on this business date."
            description="Best sellers come from completed till sales, and appear here as soon as one is confirmed."
          />
        </div>
      </Panel>
    )
  }

  const showBranchChart = data.byBranch.length > 1

  return (
    <div className={`chart-grid ${showBranchChart ? '' : 'single'}`}>
      <Panel
        title={heading}
        description={`${formatNumber(data.totalUnits)} units across ${formatNumber(data.documentCount)} ${
          data.documentCount === 1 ? 'sale' : 'sales'
        } on ${data.businessDate || 'the current business date'}.`}
        actions={
          <div className="segmented compact" role="radiogroup" aria-label="Show best sellers as">
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
            <ChartSlot height={topSellersChartHeight(data.topProducts.length)}>
              <TopSellersChart analytics={data} />
            </ChartSlot>
          </div>
        ) : (
          <TopSellersTable analytics={data} />
        )}
      </Panel>

      {showBranchChart && (
        <Panel title="Revenue by location" description={`${formatPrice(data.totalRevenue)} in total.`}>
          <div className="panel-body">
            <ChartSlot height={branchSalesChartHeight(data.byBranch.length)}>
              <BranchSalesChart analytics={data} />
            </ChartSlot>
          </div>
        </Panel>
      )}
    </div>
  )
}
