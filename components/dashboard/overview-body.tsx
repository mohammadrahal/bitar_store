'use client'

import { useState } from 'react'
import { BestSellersList } from '@/components/dashboard/best-sellers-list'
import { ChartsRow } from '@/components/dashboard/charts-row'
import { KpiRow } from '@/components/dashboard/kpi-row'
import { NeedsAttention } from '@/components/dashboard/needs-attention'
import { RangeFilter } from '@/components/dashboard/range-filter'
import { RecentSales } from '@/components/dashboard/recent-sales'
import { DEFAULT_RANGE, type RangeDays } from '@/lib/dashboard-range'
import type { BranchScope } from '@/types'

/**
 * The overview, read top to bottom: what needs doing, how trade is going, what
 * that revenue looked like day by day, and the detail behind it.
 *
 * One range control governs the whole page, so it sits in its own row above the
 * bands rather than inside any one panel, and it names its reach ("everything
 * below") instead of leaving a reader to guess which figures it moved. The
 * stock counts in the KPI row are the deliberate exception and say "right now"
 * on their own faces: a count of what is empty on a shelf has no meaning
 * averaged over ninety days.
 */
export function OverviewBody({ scope }: { scope: BranchScope }) {
  const [days, setDays] = useState<RangeDays>(DEFAULT_RANGE)

  return (
    <>
      <NeedsAttention scope={scope} />

      <div className="section-bar">
        <h2 className="section-title">Performance</h2>
        <p className="section-note">Everything below covers the last {days} days, except the stock counts.</p>
        <RangeFilter value={days} onChange={setDays} />
      </div>

      <KpiRow scope={scope} days={days} />
      <ChartsRow scope={scope} days={days} />

      <div className="detail-grid">
        <RecentSales scope={scope} days={days} />
        <BestSellersList scope={scope} days={days} />
      </div>
    </>
  )
}
