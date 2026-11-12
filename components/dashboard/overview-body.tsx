'use client'

import { BestSellersList } from '@/components/dashboard/best-sellers-list'
import { ChartsRow } from '@/components/dashboard/charts-row'
import { KpiRow } from '@/components/dashboard/kpi-row'
import { LowestSellersList } from '@/components/dashboard/lowest-sellers-list'
import { NeedsAttention } from '@/components/dashboard/needs-attention'
import { RecentSales } from '@/components/dashboard/recent-sales'
import { usePermission } from '@/hooks/use-permission'
import type { RangeDays } from '@/lib/dashboard-range'
import { ALL_BRANCHES, type BranchScope } from '@/types'

/**
 * The overview, read top to bottom: what needs doing, how trade is going, what
 * that revenue looked like day by day, and the detail behind it.
 *
 * The date range lives in the page header beside the welcome line; `days` is
 * passed in from the parent. The stock counts in the KPI row are the deliberate
 * exception and say "right now" on their own faces: a count of what is empty on
 * a shelf has no meaning averaged over ninety days.
 */
export function OverviewBody({ scope, days }: { scope: BranchScope; days: RangeDays }) {
  const { canViewBranchSalesTelemetry, canViewNetworkSalesTelemetry } = usePermission()
  const showSalesDetail =
    scope === ALL_BRANCHES
      ? canViewNetworkSalesTelemetry()
      : canViewBranchSalesTelemetry(scope)

  return (
    <>
      <NeedsAttention scope={scope} />

      <KpiRow scope={scope} days={days} />
      <ChartsRow scope={scope} days={days} />

      {showSalesDetail ? (
        <div className="detail-grid">
          <RecentSales scope={scope} days={days} />
          <div className="stack">
            <BestSellersList scope={scope} days={days} />
            <LowestSellersList scope={scope} days={days} />
          </div>
        </div>
      ) : null}
    </>
  )
}
