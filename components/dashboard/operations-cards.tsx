'use client'

import { useState } from 'react'
import { Receipt } from 'lucide-react'
import { StatCard, countOf } from '@/components/dashboard/stat-cards'
import { TodaySalesDrawer } from '@/components/dashboard/today-sales-drawer'
import { useOperationsSummary } from '@/hooks/use-inventory'
import { usePermission } from '@/hooks/use-permission'
import { formatPrice } from '@/lib/format'
import type { BranchScope, OperationsSummary } from '@/types'

/**
 * What the till has taken today, at the locations in scope. Renders the tile
 * alone rather than a grid around it: the overview places it as the first cell
 * of the row it shares with the stock figures, so today's money leads and no
 * single card is left stranded on a row of its own.
 */
export function OperationsTile({
  scope,
  prefetched,
  fromDashboardOverview,
  dashboardPending,
  dashboardFailed,
}: {
  scope: BranchScope
  /** From `GET /dashboard/overview` when the overview already fetched today. */
  prefetched?: OperationsSummary
  /** When true, wait for dashboard overview — do not fan out to `GET /sales` per branch. */
  fromDashboardOverview?: boolean
  dashboardPending?: boolean
  dashboardFailed?: boolean
}) {
  const useSalesFallback =
    !fromDashboardOverview || Boolean(dashboardFailed)
  const fallback = useOperationsSummary(scope, {
    enabled: useSalesFallback && prefetched === undefined,
  })
  const data = prefetched ?? fallback.data
  const isPending = fromDashboardOverview
    ? Boolean(dashboardPending && prefetched === undefined)
    : prefetched === undefined && fallback.isPending
  const isError = fromDashboardOverview
    ? Boolean(dashboardFailed && prefetched === undefined && fallback.isError)
    : prefetched === undefined && fallback.isError
  const { canAny, role } = usePermission()
  const [todayOpen, setTodayOpen] = useState(false)
  const sales = canAny(['sales.view_branch', 'sales.view_own'])
  const employee = role === 'employee'
  if (isPending) return <div className="skeleton skeleton-card" aria-busy="true" />
  if (isError) return <p className="field-error">Operations figures could not be loaded.</p>
  if (!data) return null

  return (
    <>
      <StatCard
        label="Today's sales"
        value={formatPrice(data.todayRevenue)}
        detail={countOf(data.todaySales, 'sale')}
        icon={Receipt}
        highlight={employee}
        onClick={employee || sales ? () => setTodayOpen(true) : undefined}
        href={sales ? '/sales/b2c' : undefined}
      />
      {todayOpen && (
        <TodaySalesDrawer
          revenue={data.todayRevenue}
          sales={data.todaySales}
          mix={data.todayMix}
          canViewList={sales}
          onClose={() => setTodayOpen(false)}
        />
      )}
    </>
  )
}
