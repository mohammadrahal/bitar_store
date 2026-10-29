import { Archive, Lock, PackageCheck, Truck, Warehouse } from 'lucide-react'
import { StatCard } from '@/components/dashboard/stat-cards'
import { balanceText } from '@/lib/balances'
import { formatNumber } from '@/lib/format'
import type { Balances } from '@/types'

/**
 * The five BL-02 balances as `GET /stock` can report them. Available is the one
 * people act on, so it is highlighted. Reserved and on hold have no endpoint
 * yet and say so rather than showing a zero that would read as a fact.
 */
export function BalanceTiles({ totals }: { totals: Balances }) {
  const pending = 'Not available yet'
  return (
    <div className="balance-grid">
      <StatCard label="On hand" value={formatNumber(totals.onHand)} detail="Physically at the location" icon={Warehouse} />
      <StatCard
        label="Reserved"
        value={balanceText(totals.reserved, formatNumber)}
        detail={totals.reserved === null ? pending : 'Approved for transfer'}
        icon={Lock}
      />
      <StatCard
        label="On hold"
        value={balanceText(totals.onHold, formatNumber)}
        detail={totals.onHold === null ? pending : 'Kept out of sale'}
        icon={Archive}
      />
      <StatCard
        label="Available"
        value={formatNumber(totals.available)}
        detail="Sellable now"
        icon={PackageCheck}
        highlight
      />
      <StatCard label="In transit" value={formatNumber(totals.inTransit)} detail="Counted once, at the receiver" icon={Truck} />
    </div>
  )
}
