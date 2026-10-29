'use client'

import Link from 'next/link'
import { ArrowLeftRight, Lock, Receipt, Truck } from 'lucide-react'
import { StatCard, countOf } from '@/components/dashboard/stat-cards'
import { useOperationsSummary } from '@/hooks/use-inventory'
import { usePermission } from '@/hooks/use-permission'
import { formatPrice } from '@/lib/format'
import type { BranchScope } from '@/types'

/** What needs attention today: open transfers, stock in motion, stock held back, and today's takings. */
export function OperationsCards({ scope }: { scope: BranchScope }) {
  const { data, isPending, isError } = useOperationsSummary(scope)
  const { can } = usePermission()
  if (isPending) return <div className="stats-grid" aria-busy="true"><div className="skeleton skeleton-card" /><div className="skeleton skeleton-card" /><div className="skeleton skeleton-card" /><div className="skeleton skeleton-card" /></div>
  if (isError) return <p className="field-error">Operations figures could not be loaded.</p>

  return (
    <div className="stats-grid">
      <Link href="/transfers" className="stat-link" aria-label={`${countOf(data.openTransfers, 'open transfer')}. View transfers`}>
        <StatCard label="Open transfers" value={String(data.openTransfers)} detail="Requested, approved or on the way" icon={ArrowLeftRight} />
      </Link>
      <StatCard label="In transit" value={String(data.inTransitUnits)} detail={data.inTransitUnits === 1 ? 'Unit on the road' : 'Units on the road'} icon={Truck} />
      {can('stock.view') ? (
        <Link href="/stock-control" className="stat-link" aria-label={`${countOf(data.onHoldUnits, 'unit')} on hold. View stock control`}>
          <StatCard label="On hold" value={String(data.onHoldUnits)} detail="Kept out of sale" alert={data.onHoldUnits > 0} icon={Lock} />
        </Link>
      ) : (
        <StatCard label="On hold" value={String(data.onHoldUnits)} detail="Kept out of sale" icon={Lock} />
      )}
      <StatCard label="Today's sales" value={formatPrice(data.todayRevenue)} detail={countOf(data.todaySales, 'sale')} icon={Receipt} />
    </div>
  )
}
