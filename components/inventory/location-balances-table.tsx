import Link from 'next/link'
import { formatNumber } from '@/lib/format'
import type { Balances, LocationBalance } from '@/types'

/** One variant at every location the user may see, with the combined row when there is more than one. */
export function LocationBalancesTable({
  locations,
  totals,
  compact = false,
}: {
  locations: LocationBalance[]
  totals: Balances
  /** The side card shows four numbers; the full page shows all five. */
  compact?: boolean
}) {
  return (
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
          </tr>
        </thead>
        <tbody>
          {locations.map((location) => (
            <tr key={location.branchId}>
              <td className="card-title">
                {location.isWarehouse ? (
                  <strong>{location.branchName}</strong>
                ) : (
                  <Link href={`/branches/${location.branchId}`} className="link-cell">
                    {location.branchName}
                  </Link>
                )}
                {location.isWarehouse && <small>Main warehouse</small>}
              </td>
              <td className="num tabular" data-label="On hand">{formatNumber(location.onHand)}</td>
              <td className="num tabular" data-label="Reserved">{formatNumber(location.reserved)}</td>
              <td className="num tabular" data-label="On hold">{formatNumber(location.onHold)}</td>
              <td className="num tabular" data-label="Available">
                <strong>{formatNumber(location.available)}</strong>
              </td>
              {!compact && (
                <td className="num tabular" data-label="In transit">{formatNumber(location.inTransit)}</td>
              )}
            </tr>
          ))}
        </tbody>
        {locations.length > 1 && (
          <tfoot>
            <tr>
              <td className="card-title">All locations</td>
              <td className="num tabular" data-label="On hand">{formatNumber(totals.onHand)}</td>
              <td className="num tabular" data-label="Reserved">{formatNumber(totals.reserved)}</td>
              <td className="num tabular" data-label="On hold">{formatNumber(totals.onHold)}</td>
              <td className="num tabular" data-label="Available">{formatNumber(totals.available)}</td>
              {!compact && <td className="num tabular" data-label="In transit">{formatNumber(totals.inTransit)}</td>}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
