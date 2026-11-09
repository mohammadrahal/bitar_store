'use client'

import { Archive, Lock, PackageCheck, Truck, Warehouse } from 'lucide-react'
import { StatCard } from '@/components/dashboard/stat-cards'
import { usePermission } from '@/hooks/use-permission'
import { balanceText } from '@/lib/balances'
import { formatNumber } from '@/lib/format'
import { inventoryVariantsHref } from '@/lib/inventory-filters'
import type { Balances } from '@/types'

/**
 * The five BL-02 balances as `GET /stock` can report them. Available is the one
 * people act on, so it is highlighted, and rule 10's arithmetic is on its face:
 * on hand, less what is on hold, less what is reserved. Reserved has no
 * endpoint and is computed from draft transfers at the sender.
 */
export function BalanceTiles({ totals }: { totals: Balances }) {
  const { can, canSeeTransfers } = usePermission()
  const stock = can('stock.view')
  const inventory = stock ? inventoryVariantsHref() : undefined
  return (
    <div className="balance-grid balance-grid--hub">
      <StatCard
        label="On hand"
        value={formatNumber(totals.onHand)}
        detail="Physically stored at location"
        icon={Warehouse}
        href={inventory}
      />
      <StatCard
        label="Reserved"
        value={balanceText(totals.reserved, formatNumber)}
        detail={totals.reserved === null ? 'Not available yet' : 'Draft transfers & hold orders'}
        icon={Lock}
        href={stock && canSeeTransfers() ? '/transfers' : undefined}
      />
      <StatCard
        label="On hold / quality"
        value={balanceText(totals.onHold, formatNumber)}
        detail={totals.onHold === null ? 'Not available yet' : 'Quarantine & inspection items'}
        icon={Archive}
        alert={Boolean(totals.onHold && totals.onHold > 0)}
        href={stock ? inventoryVariantsHref('on_hold') : undefined}
      />
      <StatCard
        label="Available (sellable)"
        value={formatNumber(totals.available)}
        detail="Sellable: on hand minus hold and reserved"
        icon={PackageCheck}
        highlight
        href={inventory}
      />
      <StatCard
        label="In transit"
        value={formatNumber(totals.inTransit)}
        detail="Dispatched between branches"
        icon={Truck}
        href={stock ? inventoryVariantsHref('in_transit') : undefined}
      />
    </div>
  )
}
