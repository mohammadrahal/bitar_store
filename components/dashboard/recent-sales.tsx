'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ReceiptText } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useBranchesKey } from '@/hooks/use-stock'
import { usePermission } from '@/hooks/use-permission'
import { rangeOf, type RangeDays } from '@/lib/dashboard-range'
import { shopToday } from '@/lib/shop-date'
import { formatNumber, formatPrice, formatRelativeDateTime } from '@/lib/format'
import { queryKeys } from '@/lib/query-keys'
import { getRecentSales } from '@/services/recent-sales.service'
import { ALL_BRANCHES, type BranchScope } from '@/types'

const RECENT_COUNT = 8

/**
 * The last eight sales, as the till recorded them. The reference opens the
 * receipt, so a question about a sale is two clicks from the overview instead
 * of a trip through the history screen's filters.
 */
export function RecentSales({ scope, days }: { scope: BranchScope; days: RangeDays }) {
  const branches = useBranchesKey()
  const { can, canAny } = usePermission()
  const branchToday = scope !== ALL_BRANCHES && scope !== '__none__'
  const today = shopToday()
  const range = branchToday ? { from: today, to: today } : rangeOf(days)
  const allowed = canAny(['sales.view_own', 'sales.view_branch']) || can('locations.view_all')

  const query = useQuery({
    queryKey: [...queryKeys.sales.all, 'recent', scope, branchToday ? 'today' : days],
    queryFn: () => getRecentSales(scope, RECENT_COUNT, range),
    enabled: branches !== null && allowed,
    staleTime: 15_000,
  })

  if (!allowed) return null

  const data = query.data
  const showLocation = scope === ALL_BRANCHES

  return (
    <Panel
      title={branchToday ? "Today's sales" : 'Recent sales'}
      headingLevel={3}
      description={
        branchToday
          ? data?.sales.length
            ? `${data.sales.length} completed today at this location.`
            : 'Completed till sales for the current shop day.'
          : data && !data.acrossDays
            ? 'Today only — this server has no sales-history route yet.'
            : `The last ${RECENT_COUNT} over the selected period.`
      }
      actions={
        <Link href={branchToday ? '/sales/b2c' : '/sales/history'} className="text-btn">
          {branchToday ? 'All today' : 'All sales'}
        </Link>
      }
    >
      {query.isPending ? (
        <div className="panel-body">
          <Skeleton rows={4} stats={0} />
        </div>
      ) : query.isError ? (
        <div className="panel-body">
          <ErrorState title="Could not load recent sales" error={query.error} onRetry={() => void query.refetch()} />
        </div>
      ) : !data || data.sales.length === 0 ? (
        <div className="panel-body">
          <EmptyState
            icon={ReceiptText}
            title="No sales yet"
            description="A sale appears here as soon as the till confirms it."
          />
        </div>
      ) : (
        <ul className="recent-sales-list panel-body" aria-label="The most recent completed sales">
          {data.sales.map((sale) => (
            <li key={sale.id} className="recent-sales-row">
              <div className="recent-sales-head">
                <Link href={`/sales/${sale.id}`} className="recent-sales-ref link-cell" title="Open sale">
                  {sale.reference}
                </Link>
                <span className="recent-sales-total tabular">{formatPrice(sale.total)}</span>
              </div>
              <p className="recent-sales-meta">
                <span>{formatRelativeDateTime(sale.soldAt)}</span>
                {showLocation && <span>{sale.branchName}</span>}
                <span>
                  {formatNumber(sale.items)} {sale.items === 1 ? 'item' : 'items'}
                </span>
                <span>{sale.payment}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
