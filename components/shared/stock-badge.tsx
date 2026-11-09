import Link from 'next/link'
import { formatNumber } from '@/lib/format'
import { inventoryVariantHref } from '@/lib/inventory-filters'
import type { InventoryRow, InventoryStatus } from '@/types'

const TONES: Record<InventoryStatus, string> = {
  in_stock: 'pill-in-stock',
  low: 'pill-low',
  out: 'pill-out',
  on_hold: 'pill-hold',
  in_transit: 'pill-transit',
  archived: 'pill-archived',
}

const LABELS: Record<InventoryStatus, string> = {
  in_stock: 'In stock',
  low: 'Low',
  out: 'Out',
  on_hold: 'On hold',
  in_transit: 'In transit',
  archived: 'Archived',
}

type BadgeRow = Pick<InventoryRow, 'status' | 'nonSellable' | 'inTransit'> &
  Partial<Pick<InventoryRow, 'available' | 'minQuantity' | 'reserved' | 'onHold' | 'variantId'>>

/**
 * The chip carries the word as well as the colour, so the state survives a
 * monochrome print and colour blindness. The figures behind it go in the title
 * rather than the label: the label has to stay the same width in every row for
 * a column of them to be scannable.
 */
function detailFor(row: BadgeRow): string | undefined {
  switch (row.status) {
    case 'low':
      return row.minQuantity != null && row.available != null
        ? `${formatNumber(row.available)} available, minimum ${formatNumber(row.minQuantity)}`
        : undefined
    case 'on_hold':
      return `${formatNumber(row.onHold ?? row.nonSellable)} on hold`
    case 'in_transit':
      return `${formatNumber(row.inTransit)} on the way`
    default:
      return undefined
  }
}

/** The one status a variant row leads with; the five numbers sit beside it. */
export function StockBadge({ row }: { row: BadgeRow }) {
  const detail = detailFor(row)
  const label = LABELS[row.status]
  const pill = (
    <span className={`pill ${TONES[row.status]}`} title={detail}>
      <span className="pill-dot" aria-hidden="true" />
      {label}
      {detail && <span className="sr-only">. {detail}</span>}
    </span>
  )
  if (row.status === 'on_hold' && row.variantId) {
    return (
      <Link href={inventoryVariantHref(row.variantId, 'on_hold')} className="pill-link">
        {pill}
      </Link>
    )
  }
  return pill
}
