import type { InventoryRow, InventoryStatus } from '@/types'

const TONES: Record<InventoryStatus, string> = {
  in_stock: 'pill-healthy',
  out: 'pill-out',
  on_hold: 'pill-hold',
  in_transit: 'pill-transit',
  archived: 'pill-archived',
}

function labelFor(row: Pick<InventoryRow, 'status' | 'nonSellable' | 'inTransit'>) {
  switch (row.status) {
    case 'in_stock':
      return 'In stock'
    case 'out':
      return 'Out of stock'
    case 'on_hold':
      return `${row.nonSellable} non-sellable`
    case 'in_transit':
      return `${row.inTransit} in transit`
    case 'archived':
      return 'Archived'
  }
}

/** The one status a variant row leads with; the five numbers sit beside it. */
export function StockBadge({ row }: { row: Pick<InventoryRow, 'status' | 'nonSellable' | 'inTransit'> }) {
  return (
    <span className={`pill ${TONES[row.status]}`}>
      <span className="pill-dot" aria-hidden="true" />
      {labelFor(row)}
    </span>
  )
}
