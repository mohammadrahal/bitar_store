import { Archive, Lock, PackageCheck, Truck, Warehouse } from 'lucide-react'
import { StatCard } from '@/components/dashboard/stat-cards'
import { formatNumber } from '@/lib/format'
import type { Balances } from '@/types'

/** The five BL-02 balances. Available is the one people act on, so it is highlighted. */
export function BalanceTiles({ totals }: { totals: Balances }) {
  return (
    <div className="balance-grid">
      <StatCard label="On hand" value={formatNumber(totals.onHand)} detail="Physically at the location" icon={Warehouse} />
      <StatCard label="Reserved" value={formatNumber(totals.reserved)} detail="Approved for transfer" icon={Lock} />
      <StatCard label="On hold" value={formatNumber(totals.onHold)} detail="Kept out of sale" icon={Archive} />
      <StatCard
        label="Available"
        value={formatNumber(totals.available)}
        detail="On hand − reserved − on hold"
        icon={PackageCheck}
        highlight
      />
      <StatCard label="In transit" value={formatNumber(totals.inTransit)} detail="Counted once, at the receiver" icon={Truck} />
    </div>
  )
}
