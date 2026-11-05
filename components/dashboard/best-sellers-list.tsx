'use client'

import Link from 'next/link'
import { ReceiptText } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useAnalyticsCoversRange, useSalesAnalytics } from '@/hooks/use-analytics'
import { formatNumber, formatPrice } from '@/lib/format'
import { variantLabel, variantSpoken } from '@/lib/variant-label'
import type { RangeDays } from '@/lib/dashboard-range'
import type { BranchScope } from '@/types'

const TOP = 5

/**
 * The five best sellers as a ranked list rather than a chart.
 *
 * Five bars is not a distribution worth an axis and a legend: the reader wants
 * the order and roughly how far ahead the leader is, which a bar behind each
 * row gives in a third of the height. The bar is scaled to the leader, so the
 * first row is always full — it shows share of the top seller, not of the total.
 */
export function BestSellersList({ scope, days }: { scope: BranchScope; days: RangeDays }) {
  const { data, isPending, isError, error, refetch } = useSalesAnalytics(scope, days)
  const coversRange = useAnalyticsCoversRange()

  const rows = (data?.topProducts ?? []).slice(0, TOP)
  const peak = rows.reduce((max, row) => Math.max(max, row.units), 0)

  return (
    <Panel
      title="Best sellers"
      headingLevel={3}
      description={
        coversRange ? `By units over the last ${days} days.` : 'By units today — a wider window needs financial reports.'
      }
    >
      {isPending ? (
        <div className="panel-body">
          <Skeleton rows={3} stats={0} />
        </div>
      ) : isError ? (
        <div className="panel-body">
          <ErrorState title="Could not load best sellers" error={error} onRetry={() => void refetch()} />
        </div>
      ) : rows.length === 0 ? (
        <div className="panel-body">
          <EmptyState
            icon={ReceiptText}
            title="Nothing sold yet"
            description="Best sellers come from completed till sales."
          />
        </div>
      ) : (
        <ol className="rank-list panel-body">
          {rows.map((row, index) => (
            <li key={row.variantId || row.sku} className="rank-row">
              <span className="rank-index tabular" aria-hidden="true">
                {index + 1}
              </span>
              <span className="rank-body">
                <Link
                  href={`/inventory/${row.variantId}`}
                  className="rank-name link-cell"
                  aria-label={`${variantSpoken(row)}, ${formatNumber(row.units)} units`}
                >
                  {variantLabel(row)}
                </Link>
                <span className="rank-meta">
                  <span className="rank-sku">{row.sku}</span>
                  <span className="rank-figure tabular">
                    {formatNumber(row.units)} · {formatPrice(row.revenue)}
                  </span>
                </span>
                {/* Decoration for the figure beside it, so it carries no label
                    of its own and is hidden from the reading order. */}
                <span className="rank-bar" aria-hidden="true">
                  <span className="rank-bar-fill" style={{ width: `${peak > 0 ? (row.units / peak) * 100 : 0}%` }} />
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}
