'use client'

import { Archive, Lock, PackageCheck, Truck, Warehouse } from 'lucide-react'
import { StatCard } from '@/components/dashboard/stat-cards'
import { usePermission } from '@/hooks/use-permission'
import { balanceText } from '@/lib/balances'
import { formatNumber } from '@/lib/format'
import { inventoryHref } from '@/lib/inventory-filters'
import type { Balances } from '@/types'

/**
 * The five BL-02 balances as `GET /stock` can report them. Available is the one
 * people act on, so it is highlighted. Reserved and on hold have no endpoint
 * yet and say so rather than showing a zero that would read as a fact.
 */
export function BalanceTiles({ totals }: { totals: Balances }) {
  const { can } = usePermission()
  const pending = 'Not available yet'
  const stock = can('stock.view')
  const inventory = stock ? inventoryHref() : undefined
  return (
    <div className="balance-grid">
      <StatCard
        label="On hand"
        value={formatNumber(totals.onHand)}
        detail="Physically at the location"
        icon={Warehouse}
        href={inventory}
      />
      <StatCard
        label="Reserved"
        value={balanceText(totals.reserved, formatNumber)}
        detail={totals.reserved === null ? pending : 'Approved for transfer'}
        icon={Lock}
        href={stock ? '/transfers' : undefined}
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
        href={inventory}
      />
      <StatCard
        label="In transit"
        value={formatNumber(totals.inTransit)}
        detail="Counted once, at the receiver"
        icon={Truck}
        href={stock ? inventoryHref('in_transit') : undefined}
      />
    </div>
  )
}
