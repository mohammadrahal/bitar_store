import type { InventoryRow, InventoryStatus } from '@/types'

const TONES: Record<InventoryStatus, string> = {
  in_stock: 'pill-healthy',
  low: 'pill-low',
  out: 'pill-out',
  on_hold: 'pill-hold',
  in_transit: 'pill-transit',
  archived: 'pill-archived',
}

function labelFor(row: Pick<InventoryRow, 'status' | 'onHold' | 'inTransit'>) {
  switch (row.status) {
    case 'in_stock':
      return 'In stock'
    case 'low':
      return 'Low stock'
    case 'out':
      return 'Out of stock'
    case 'on_hold':
      return `${row.onHold} on hold`
    case 'in_transit':
      return `${row.inTransit} in transit`
    case 'archived':
      return 'Archived'
  }
}

/** The one status a variant row leads with; the five numbers sit beside it. */
export function StockBadge({ row }: { row: Pick<InventoryRow, 'status' | 'onHold' | 'inTransit'> }) {
  return (
    <span className={`pill ${TONES[row.status]}`}>
      <span className="pill-dot" aria-hidden="true" />
      {labelFor(row)}
    </span>
  )
}
