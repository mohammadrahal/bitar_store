'use client'

import { useState } from 'react'
import { Receipt } from 'lucide-react'
import { StatCard, countOf } from '@/components/dashboard/stat-cards'
import { TodaySalesDrawer } from '@/components/dashboard/today-sales-drawer'
import { StaggerList } from '@/components/motion/stagger'
import { useOperationsSummary } from '@/hooks/use-inventory'
import { usePermission } from '@/hooks/use-permission'
import { formatPrice } from '@/lib/format'
import type { BranchScope } from '@/types'

/** What the till has taken today, at the locations in scope. */
export function OperationsCards({ scope }: { scope: BranchScope }) {
  const { data, isPending, isError } = useOperationsSummary(scope)
  const { canAny, role } = usePermission()
  const [todayOpen, setTodayOpen] = useState(false)
  const sales = canAny(['sales.view_branch', 'sales.view_own'])
  const employee = role === 'employee'
  if (isPending)
    return (
      <div className="stats-grid" aria-busy="true"><div className="skeleton skeleton-card" /></div>
    )
  if (isError) return <p className="field-error">Operations figures could not be loaded.</p>

  return (
    <>
      <StaggerList className="stats-grid">
        <StatCard
          label="Today's sales"
          value={formatPrice(data.todayRevenue)}
          detail={countOf(data.todaySales, 'sale')}
          icon={Receipt}
          highlight={employee}
          onClick={employee || sales ? () => setTodayOpen(true) : undefined}
          href={sales ? '/sales/b2c' : undefined}
        />
      </StaggerList>
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
