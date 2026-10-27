'use client'

import { useState } from 'react'
import { ReceiptText } from 'lucide-react'
import { BranchSalesChart } from '@/components/dashboard/branch-sales-chart'
import { TopSellersChart } from '@/components/dashboard/top-sellers-chart'
import { TopSellersTable } from '@/components/dashboard/top-sellers-table'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useSalesAnalytics } from '@/hooks/use-analytics'
import { formatNumber, formatPrice } from '@/lib/format'
import type { BranchScope } from '@/types'

type View = 'chart' | 'numbers'

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
            title="No sales recorded in this period."
            description="Best sellers appear here once a sale is confirmed."
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
          data.documentCount === 1 ? 'document' : 'documents'
        }, returns deducted.`}
        actions={
          <div className="segmented compact">
            <button type="button" className={view === 'chart' ? 'active' : ''} onClick={() => setView('chart')}>
              Chart
            </button>
            <button type="button" className={view === 'numbers' ? 'active' : ''} onClick={() => setView('numbers')}>
              Numbers
            </button>
          </div>
        }
      >
        {view === 'chart' ? (
          <div className="panel-body">
            <TopSellersChart analytics={data} />
          </div>
        ) : (
          <TopSellersTable analytics={data} />
        )}
      </Panel>

      {showBranchChart && (
        <Panel title="Revenue by branch" description={`${formatPrice(data.totalRevenue)} in total.`}>
          <div className="panel-body">
            <BranchSalesChart analytics={data} />
          </div>
        </Panel>
      )}
    </div>
  )
}
