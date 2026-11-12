'use client'

import Link from 'next/link'
import { ArrowUpRight, PackageCheck } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useAnalyticsCoversRange, useSalesAnalytics } from '@/hooks/use-analytics'
import { usePermission } from '@/hooks/use-permission'
import { useStockHealth } from '@/hooks/use-stock-health'
import { inventoryHref } from '@/lib/inventory-filters'
import { formatNumber } from '@/lib/format'
import { variantLabel, variantSpoken } from '@/lib/variant-label'
import type { RangeDays } from '@/lib/dashboard-range'
import { ALL_BRANCHES, type BranchScope } from '@/types'

const BOTTOM = 5

/**
 * The counterpart to best sellers: what is on the shelf in scope and sold least
 * over the period, zero included.
 *
 * Only variants with sellable stock are ranked. A variant with nothing on the
 * shelf did not get the chance to sell, so ranking it would say more about
 * restocking than about demand. Ties on units go to the one with more stock
 * sitting idle, because that is the money tied up.
 *
 * `GET /reports/top-skus` stops at 100 rows. When it is full, a variant missing
 * from it sold no more than the last row did, so it reads "≤ n sold" rather than
 * a zero nobody measured.
 */
export function LowestSellersList({
  scope,
  days,
  stockScope = scope,
  description = 'In stock, fewest units sold',
}: {
  /** Where the sales are counted. */
  scope: BranchScope
  days: RangeDays
  /** Where the stock sits, when that is not where it sells (the warehouse). */
  stockScope?: BranchScope
  description?: string
}) {
  const { canViewBranchSalesTelemetry, canViewNetworkSalesTelemetry } = usePermission()
  const allowed =
    scope === ALL_BRANCHES ? canViewNetworkSalesTelemetry() : canViewBranchSalesTelemetry(scope)
  const sales = useSalesAnalytics(scope, days, allowed)
  const stock = useStockHealth(stockScope)
  const coversRange = useAnalyticsCoversRange()

  if (!allowed) return null

  const isPending = sales.isPending || stock.isPending
  const failed = sales.isError ? sales : stock.isError ? stock : null

  const sold = sales.data?.unitsByVariant ?? {}
  const complete = sales.data?.unitsComplete ?? true
  const floor = complete ? 0 : Math.min(...Object.values(sold))
  const rows = Object.values(stock.data?.sellable ?? {})
    .map((variant) => {
      const units = sold[variant.variantId]
      return { ...variant, units: units ?? 0, measured: units !== undefined || complete }
    })
    .sort((a, b) => a.units - b.units || b.sellable - a.sellable || a.sku.localeCompare(b.sku))
    .slice(0, BOTTOM)

  const soldText = (row: (typeof rows)[number]) =>
    row.measured ? `${formatNumber(row.units)} sold` : `≤ ${formatNumber(floor)} sold`

  return (
    <Panel
      title="Slowest Sellers"
      headingLevel={3}
      description={description}
      className="overview-feed-panel"
      actions={<span className="overview-panel-badge">{coversRange ? `${days}d cycle` : 'Today'}</span>}
    >
      {isPending ? (
        <div className="panel-body">
          <Skeleton rows={3} stats={0} />
        </div>
      ) : failed ? (
        <div className="panel-body">
          <ErrorState title="Could not load slowest sellers" error={failed.error} onRetry={() => void failed.refetch()} />
        </div>
      ) : rows.length === 0 ? (
        <div className="panel-body">
          <EmptyState
            icon={PackageCheck}
            title="Nothing in stock here"
            description="Slowest sellers rank the variants that have stock on the shelf."
          />
        </div>
      ) : (
        <>
          <ol className="rank-list rank-list--rich panel-body">
            {rows.map((row, index) => (
              <li key={row.variantId} className="rank-row rank-row--rich">
                <span className="rank-medal tabular" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="rank-body">
                  <div className="rank-top">
                    <div className="rank-copy">
                      <Link
                        href={`/inventory/${row.variantId}`}
                        className="rank-name link-cell"
                        aria-label={`${variantSpoken(row)}, ${soldText(row)}, ${formatNumber(row.sellable)} in stock`}
                      >
                        {variantLabel(row)}
                      </Link>
                      <span className="rank-sku">{row.sku}</span>
                    </div>
                    <div className="rank-stats">
                      <span className="rank-units tabular">{soldText(row)}</span>
                      <span className="rank-stock tabular">{formatNumber(row.sellable)} in stock</span>
                    </div>
                  </div>
                </span>
              </li>
            ))}
          </ol>
          <div className="overview-panel-footer">
            <Link href={inventoryHref('all')} className="overview-panel-footer-link">
              View inventory
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </>
      )}
    </Panel>
  )
}
