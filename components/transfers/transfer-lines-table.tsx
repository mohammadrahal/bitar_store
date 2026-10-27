import Link from 'next/link'
import { lineInTransit } from '@/lib/transfers'
import type { TransferRow } from '@/types'

export function TransferLinesTable({ transfer }: { transfer: TransferRow }) {
  const { totals } = transfer
  return (
    <>
      <div className="table-wrap">
        <table className="card-table">
          <caption className="sr-only">Lines on {transfer.number}</caption>
          <thead>
            <tr>
              <th scope="col">Variant</th>
              <th scope="col" className="num">Requested</th>
              <th scope="col" className="num">Approved</th>
              <th scope="col" className="num">Dispatched</th>
              <th scope="col" className="num">Received</th>
              <th scope="col" className="num">In transit</th>
            </tr>
          </thead>
          <tbody>
            {transfer.lines.map((line) => (
              <tr key={line.variantId}>
                <td className="card-title">
                  <Link href={`/inventory/${line.variantId}`} className="link-cell">
                    {line.productName} {line.color} / {line.size}
                  </Link>
                  <small className="tabular">{line.sku}</small>
                </td>
                <td className="num tabular" data-label="Requested">{line.requested}</td>
                <td className="num tabular" data-label="Approved">{line.approved}</td>
                <td className="num tabular" data-label="Dispatched">{line.dispatched}</td>
                <td className="num tabular" data-label="Received">
                  {line.received}
                  {(line.damaged > 0 || line.missing > 0) && (
                    <small>
                      {[line.damaged > 0 && `${line.damaged} on hold`, line.missing > 0 && `${line.missing} missing`]
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                  )}
                </td>
                <td className="num tabular" data-label="In transit">{lineInTransit(line)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="outcome tabular">
        <span>
          Accepted <strong>{totals.received}</strong>
        </span>
        <span>
          Damaged or wrong, on hold <strong>{totals.damaged}</strong>
        </span>
        <span>
          Missing <strong>{totals.missing}</strong>
        </span>
        <span>
          In transit <strong>{totals.inTransit}</strong>
        </span>
        <span>
          Still reserved at sender <strong>{totals.stillReserved}</strong>
        </span>
      </p>
    </>
  )
}
