'use client'

import { AlertTriangle, PackageX, Receipt, ShoppingBag } from 'lucide-react'
import { StatCard, countOf } from '@/components/dashboard/stat-cards'
import { StaggerList } from '@/components/motion/stagger'
import { useDashboardOverview } from '@/hooks/use-dashboard-overview'
import { useDashboardTrend, useTrendComparison } from '@/hooks/use-dashboard-trend'
import { useOperationsSummary } from '@/hooks/use-inventory'
import { usePermission } from '@/hooks/use-permission'
import { useStockHealth } from '@/hooks/use-stock-health'
import { deltaOf, type RangeDays } from '@/lib/dashboard-range'
import { formatNumber, formatPrice } from '@/lib/format'
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

/** Today's takings, for the small line under the period's revenue. */
function useTodayRevenue(scope: BranchScope) {
  const { canViewFinancialReports } = usePermission()
  const financial = canViewFinancialReports()
  const dashboard = useDashboardOverview(scope)
  /* `GET /dashboard/overview` needs `reports.financial`; everyone else gets
     today from `GET /sales` per branch, which is the same figure either way. */
  const fallback = useOperationsSummary(scope, { enabled: !financial })
  return financial ? dashboard.data?.operations.todayRevenue : fallback.data?.todayRevenue
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
  const today = useTodayRevenue(scope)
  const { can, canViewFinancialReports } = usePermission()

  const since = `vs previous ${days} days`
  const revenueDelta = trend.data && previous.data ? deltaOf(trend.data.revenue, previous.data.revenue) : null
  const salesDelta = trend.data && previous.data ? deltaOf(trend.data.sales, previous.data.sales) : null
  const comparisonReady = Boolean(trend.data && previous.data)

  const stock = can('stock.view')
  const money = canViewFinancialReports()

  if (money && !trend.data && !trend.isError) return <RowSkeleton />

  return (
    <StaggerList className="stats-grid">
      {money && (
        <StatCard
          label="Revenue"
          value={trend.data ? formatPrice(trend.data.revenue) : '—'}
          detail={trend.data ? `Over the last ${days} days` : 'Figures unavailable'}
          aside={today === undefined ? undefined : `${formatPrice(today)} today`}
          icon={Receipt}
          delta={revenueDelta}
          deltaSince={comparisonReady ? since : undefined}
          href="/reports"
        />
      )}
      {money && (
        <StatCard
          label="Sales"
          value={trend.data ? formatNumber(trend.data.sales) : '—'}
          detail={trend.data ? 'Completed till sales' : 'Figures unavailable'}
          aside={trend.data ? `${countOf(trend.data.items, 'item')} sold` : undefined}
          icon={ShoppingBag}
          delta={salesDelta}
          deltaSince={comparisonReady ? since : undefined}
          href="/sales/history"
        />
      )}
      {stock && (
        <StatCard
          label="Low stock"
          value={health.data?.minimumsKnown ? formatNumber(health.data.lowStock) : '—'}
          detail={
            health.data?.minimumsKnown
              ? health.data.lowElsewhere > 0
                ? `${formatNumber(health.data.lowElsewhere)} still stocked elsewhere`
                : 'At or under its minimum, right now'
              : 'No minimums set for this scope'
          }
          alert={Boolean(health.data?.lowStock)}
          icon={AlertTriangle}
          href={inventoryHref('low')}
        />
      )}
      {stock && (
        <StatCard
          label="Out of stock"
          value={health.data ? formatNumber(health.data.outOfStock) : '—'}
          /* The second line is the point of the card: "34 variants" is only
             readable next to "of 225", and the branch-level misses are a
             different problem from a variant nobody has any of. */
          detail={
            health.data
              ? health.data.outElsewhere > 0
                ? `${formatNumber(health.data.outElsewhere)} more out at some locations`
                : `Of ${countOf(health.data.variantCount, 'variant')}, right now`
              : 'Figures unavailable'
          }
          alert={Boolean(health.data?.outOfStock)}
          icon={PackageX}
          href={inventoryHref('out')}
        />
      )}
    </StaggerList>
  )
}
