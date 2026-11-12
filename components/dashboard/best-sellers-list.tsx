'use client'

import Link from 'next/link'
import { ArrowUpRight, ReceiptText } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useAnalyticsCoversRange, useSalesAnalytics } from '@/hooks/use-analytics'
import { usePermission } from '@/hooks/use-permission'
import { ALL_BRANCHES, type BranchScope } from '@/types'
import { formatNumber, formatPrice } from '@/lib/format'
import { variantLabel, variantSpoken } from '@/lib/variant-label'
import type { RangeDays } from '@/lib/dashboard-range'

const TOP = 5

/**
 * The five best sellers as a ranked list rather than a chart.
 *
 * Five bars is not a distribution worth an axis and a legend: the reader wants
 * the order and roughly how far ahead the leader is, which a bar behind each
 * row gives in a third of the height. The bar is scaled to the leader, so the
 * first row is always full. it shows share of the top seller, not of the total.
 */
export function BestSellersList({
  scope,
  days,
  description = 'Velocity ranked by units sold',
}: {
  scope: BranchScope
  days: RangeDays
  description?: string
}) {
  const { canViewBranchSalesTelemetry, canViewNetworkSalesTelemetry } = usePermission()
  const allowed =
    scope === ALL_BRANCHES
      ? canViewNetworkSalesTelemetry()
      : canViewBranchSalesTelemetry(scope)
  const { data, isPending, isError, error, refetch } = useSalesAnalytics(scope, days, allowed)
  const coversRange = useAnalyticsCoversRange()

  if (!allowed) return null

  const rows = (data?.topProducts ?? []).slice(0, TOP)
  const peak = rows.reduce((max, row) => Math.max(max, row.units), 0)

  return (
    <Panel
      title="Best Sellers"
      headingLevel={3}
      description={description}
      className="overview-feed-panel"
      actions={
        <span className="overview-panel-badge">{coversRange ? `${days}d cycle` : 'Today'}</span>
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
        <>
          <ol className="rank-list rank-list--rich panel-body">
            {rows.map((row, index) => (
              <li key={row.variantId || row.sku} className="rank-row rank-row--rich">
                <span
                  className={`rank-medal tabular ${index === 0 ? 'rank-medal--lead' : ''}`}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <span className="rank-body">
                  <div className="rank-top">
                    <div className="rank-copy">
                      <Link
                        href={`/inventory/${row.variantId}`}
                        className="rank-name link-cell"
                        aria-label={`${variantSpoken(row)}, ${formatNumber(row.units)} units`}
                      >
                        {variantLabel(row)}
                      </Link>
                      <span className="rank-sku">{row.sku}</span>
                    </div>
                    <div className="rank-stats">
                      <span className="rank-units tabular">
                        {formatNumber(row.units)} sold
                      </span>
                      <span className="rank-revenue tabular">{formatPrice(row.revenue)}</span>
                    </div>
                  </div>
                  <span className="rank-bar" aria-hidden="true">
                    <span
                      className="rank-bar-fill"
                      style={{ width: `${peak > 0 ? (row.units / peak) * 100 : 0}%` }}
                    />
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <div className="overview-panel-footer">
            <Link href="/products" className="overview-panel-footer-link">
              View full product catalog
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </>
      )}
    </Panel>
  )
}
