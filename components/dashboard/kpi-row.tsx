'use client'

import { AlertTriangle, Check, PackageX, Receipt, ShoppingBag } from 'lucide-react'
import { StatCard, countOf } from '@/components/dashboard/stat-cards'
import { StaggerList } from '@/components/motion/stagger'
import { useDashboardTrend, useTrendComparison } from '@/hooks/use-dashboard-trend'
import { usePermission } from '@/hooks/use-permission'
import { useStockHealth } from '@/hooks/use-stock-health'
import { deltaOf, type RangeDays } from '@/lib/dashboard-range'
import { formatNumber, formatPrice } from '@/lib/format'
import { adminHubHref } from '@/lib/admin-hub'
import { inventoryHref } from '@/lib/inventory-filters'
import type { BranchScope } from '@/types'

function RowSkeleton() {
  return (
    <div className="stats-grid" aria-busy="true">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="skeleton skeleton-card" />
      ))}
    </div>
  )
}

/**
 * The four figures the overview leads with: what the business took over the
 * chosen window, how many sales that was, and the two stock counts that need
 * acting on.
 *
 * The money figures carry a trend against the preceding window of the same
 * length. The stock counts deliberately do not: "how many variants are empty"
 * is a fact about this moment, and a percentage against last month would invite
 * a comparison that has no meaning. They say "right now" on their face instead,
 * and each card is a link to the list behind its number.
 */
export function KpiRow({ scope, days }: { scope: BranchScope; days: RangeDays }) {
  const trend = useDashboardTrend(scope, days)
  const previous = useTrendComparison(scope, days)
  const health = useStockHealth(scope)
  const { can, canManageMinimums, canViewFinancialReports } = usePermission()

  const since = `vs previous ${days} days`
  const revenueDelta = trend.data && previous.data ? deltaOf(trend.data.revenue, previous.data.revenue) : null
  const salesDelta = trend.data && previous.data ? deltaOf(trend.data.sales, previous.data.sales) : null
  const comparisonReady = Boolean(trend.data && previous.data)

  const stock = can('stock.view') || canManageMinimums()
  const money = canViewFinancialReports()

  if (money && !trend.data && !trend.isError) return <RowSkeleton />

  return (
    <StaggerList className="stats-grid">
      {money && (
        <StatCard
          simple
          label="Revenue"
          value={trend.data ? formatPrice(trend.data.revenue) : ''}
          animateValue={trend.data?.revenue}
          formatAnimated={formatPrice}
          icon={Receipt}
          delta={revenueDelta}
          deltaSince={comparisonReady ? since : undefined}
          href={adminHubHref('reports')}
        />
      )}
      {money && (
        <StatCard
          simple
          label="Sales"
          value={trend.data ? formatNumber(trend.data.sales) : ''}
          animateValue={trend.data?.sales}
          formatAnimated={formatNumber}
          icon={ShoppingBag}
          delta={salesDelta}
          deltaSince={comparisonReady ? since : undefined}
          href="/sales/history"
        />
      )}
      {stock && (
        <StatCard
          simple
          label="Low stock"
          value={health.data?.minimumsKnown ? formatNumber(health.data.lowStock) : ''}
          animateValue={health.data?.minimumsKnown ? health.data.lowStock : undefined}
          formatAnimated={formatNumber}
          detail={
            health.data?.minimumsKnown
              ? health.data.lowStock > 0
                ? health.data.lowElsewhere > 0
                  ? `${formatNumber(health.data.lowElsewhere)} stocked elsewhere`
                  : 'Right now'
                : health.data.lowElsewhere > 0
                  ? `${formatNumber(health.data.lowElsewhere)} stocked elsewhere`
                  : 'Zero thresholds breached this week'
              : 'No minimums set'
          }
          heroStatus={
            health.data?.minimumsKnown && health.data.lowStock === 0
              ? { label: 'Healthy buffers', tone: 'good', icon: Check }
              : undefined
          }
          alert={Boolean(health.data?.lowStock)}
          icon={AlertTriangle}
          href={inventoryHref('low')}
        />
      )}
      {stock && (
        <StatCard
          simple
          label="Out of stock"
          value={health.data ? formatNumber(health.data.outOfStock) : ''}
          animateValue={health.data?.outOfStock}
          formatAnimated={formatNumber}
          detail={
            health.data
              ? health.data.outElsewhere > 0
                ? `${formatNumber(health.data.outElsewhere)} more at other locations`
                : `Of ${countOf(health.data.variantCount, 'variant')}`
              : ''
          }
          alert={Boolean(health.data?.outOfStock)}
          highlight={Boolean(health.data?.outOfStock)}
          icon={PackageX}
          href={inventoryHref('out')}
        />
      )}
    </StaggerList>
  )
}
