'use client'

import { BestSellersList } from '@/components/dashboard/best-sellers-list'
import { LowestSellersList } from '@/components/dashboard/lowest-sellers-list'
import { useBranches } from '@/hooks/use-branches'
import type { RangeDays } from '@/lib/dashboard-range'
import { ALL_BRANCHES, type BranchScope } from '@/types'

/**
 * Best and slowest sellers side by side, for the stock screens.
 *
 * A warehouse never sells (the server refuses a sale there), so for one the
 * sales are counted across every branch while the stock is the warehouse's own:
 * what the shops move fastest is what to keep on these shelves, and what they
 * barely move is what is sitting here.
 */
export function SellersPanels({ location, days }: { location: BranchScope; days: RangeDays }) {
  const { data: branches } = useBranches()
  const isWarehouse =
    location !== ALL_BRANCHES && branches?.find((branch) => branch.id === location)?.kind === 'warehouse'
  const salesScope = isWarehouse ? ALL_BRANCHES : location

  return (
    <div className="sellers-grid">
      <BestSellersList
        scope={salesScope}
        days={days}
        description={isWarehouse ? 'Across all branches, ranked by units sold' : undefined}
      />
      <LowestSellersList
        scope={salesScope}
        stockScope={location}
        days={days}
        description={isWarehouse ? 'In stock here, fewest units sold across all branches' : undefined}
      />
    </div>
  )
}
