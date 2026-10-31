'use client'

import { ArrowLeftRight, Lock, Receipt, Truck } from 'lucide-react'
import { StatCard, countOf } from '@/components/dashboard/stat-cards'
import { StaggerList } from '@/components/motion/stagger'
import { useOperationsSummary } from '@/hooks/use-inventory'
import { usePermission } from '@/hooks/use-permission'
import { formatPrice } from '@/lib/format'
import { inventoryHref } from '@/lib/inventory-filters'
import type { BranchScope } from '@/types'

/** What needs attention today: open transfers, stock in motion, stock held back, and today's takings. */
export function OperationsCards({ scope }: { scope: BranchScope }) {
  const { data, isPending, isError } = useOperationsSummary(scope)
  const { can, canAny } = usePermission()
  const stock = can('stock.view')
  const sales = canAny(['sales.view_branch', 'sales.view_own'])
  if (isPending)
    return (
      <div className="stats-grid" aria-busy="true"><div className="skeleton skeleton-card" /><div className="skeleton skeleton-card" /><div className="skeleton skeleton-card" /><div className="skeleton skeleton-card" /></div>
    )
  if (isError) return <p className="field-error">Operations figures could not be loaded.</p>

  return (
    <StaggerList className="stats-grid">
      <StatCard
        label="Open transfers"
        value={String(data.openTransfers)}
        detail="Requested, approved or on the way"
        icon={ArrowLeftRight}
        href={stock ? '/transfers' : undefined}
      />
      <StatCard
        label="In transit"
        value={String(data.inTransitUnits)}
        detail={data.inTransitUnits === 1 ? 'Unit on the road' : 'Units on the road'}
        icon={Truck}
        href={stock ? inventoryHref('in_transit') : undefined}
      />
      <StatCard
        label="On hold"
        value={String(data.onHoldUnits)}
        detail="Kept out of sale"
        alert={data.onHoldUnits > 0}
        icon={Lock}
        href={stock ? '/stock-control' : undefined}
      />
      <StatCard
        label="Today's sales"
        value={formatPrice(data.todayRevenue)}
        detail={countOf(data.todaySales, 'sale')}
        icon={Receipt}
        href={sales ? '/sales/b2c' : undefined}
      />
    </StaggerList>
  )
}
