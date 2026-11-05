'use client'

import Link from 'next/link'
import { Truck } from 'lucide-react'
import { Pagination } from '@/components/shared/pagination'
import { useBranchHref } from '@/hooks/use-branches'
import { usePagination } from '@/hooks/use-pagination'
import { balanceText } from '@/lib/balances'
import { formatNumber } from '@/lib/format'
import type { Balances, LocationBalance } from '@/types'

/**
 * What is on its way to a location, for the compact card only.
 *
 * The compact card drops the In transit column to keep four numbers instead of
 * five, which left it the one view that showed a destination as nothing on hand,
 * nothing available, and no sign that a transfer was coming — a reader could
 * fairly conclude nothing was on its way. The column stays dropped; the figure
 * comes back as a line under the location name, where it does not disturb the
 * alignment of the numeric columns.
 */
function InTransitNote({ units }: { units: number }) {
  return (
    <span className="in-transit-note">
      <Truck size={11} aria-hidden="true" />
      <span className="tabular">{formatNumber(units)}</span> in transit
    </span>
  )
}

/** One variant at every location the user may see, with the combined row when there is more than one. */
export function LocationBalancesTable({
  locations,
  totals,
  compact = false,
  onAdjust,
}: {
  locations: LocationBalance[]
  totals: Balances
  /**
   * The side card shows four numbers; the full page shows all five. In transit
   * is not lost on the card — it appears under the location name instead.
   */
  compact?: boolean
  /** Given when the viewer may correct a balance; adds a per-location action. */
  onAdjust?: (location: LocationBalance) => void
}) {
  const hrefOf = useBranchHref()
  const { visible, page, pageCount, total, pageSize, setPage } = usePagination(locations, 10)

  return (
    <>
    <div className="table-wrap">
      <table className="card-table">
        <caption className="sr-only">Balances by location</caption>
        <thead>
          <tr>
            <th scope="col">Location</th>
            <th scope="col" className="num">On hand</th>
            <th scope="col" className="num">Reserved</th>
            <th scope="col" className="num">On hold</th>
            <th scope="col" className="num">Available</th>
            {!compact && <th scope="col" className="num">In transit</th>}
            {onAdjust && (
              <th scope="col" className="num">
                <span className="sr-only">Correct the balance</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {visible.map((location) => (
            <tr key={location.branchId}>
              <td className="card-title">
                {location.isWarehouse ? (
                  <strong>{location.branchName}</strong>
                ) : (
                  <Link href={hrefOf(location.branchId)} className="link-cell">
                    {location.branchName}
                  </Link>
                )}
                {(location.isWarehouse || (compact && location.inTransit > 0)) && (
                  <small className="location-cell-meta">
                    {location.isWarehouse && <span>Main warehouse</span>}
                    {compact && location.inTransit > 0 && <InTransitNote units={location.inTransit} />}
                  </small>
                )}
              </td>
              <td className="num tabular" data-label="On hand">{formatNumber(location.onHand)}</td>
              <td className="num tabular" data-label="Reserved">{balanceText(location.reserved, formatNumber)}</td>
              <td className="num tabular" data-label="On hold">{balanceText(location.onHold, formatNumber)}</td>
              <td className="num tabular" data-label="Available">
                <strong>{formatNumber(location.available)}</strong>
              </td>
              {!compact && (
                <td className="num tabular" data-label="In transit">{formatNumber(location.inTransit)}</td>
              )}
              {onAdjust && (
                <td className="num">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => onAdjust(location)}>
                    Correct
                    <span className="sr-only"> the balance at {location.branchName}</span>
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        {locations.length > 1 && (
          <tfoot>
            <tr>
              <td className="card-title">
                All locations
                {compact && totals.inTransit > 0 && (
                  <small className="location-cell-meta">
                    <InTransitNote units={totals.inTransit} />
                  </small>
                )}
              </td>
              <td className="num tabular" data-label="On hand">{formatNumber(totals.onHand)}</td>
              <td className="num tabular" data-label="Reserved">{balanceText(totals.reserved, formatNumber)}</td>
              <td className="num tabular" data-label="On hold">{balanceText(totals.onHold, formatNumber)}</td>
              <td className="num tabular" data-label="Available">{formatNumber(totals.available)}</td>
              {!compact && <td className="num tabular" data-label="In transit">{formatNumber(totals.inTransit)}</td>}
              {onAdjust && <td />}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
    <Pagination page={page} pageCount={pageCount} total={total} pageSize={pageSize} onPage={setPage} />
    </>
  )
}
