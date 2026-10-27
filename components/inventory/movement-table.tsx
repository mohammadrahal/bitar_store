import Link from 'next/link'
import { History } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { formatRelativeDateTime, formatSigned } from '@/lib/format'
import type { Movement, MovementKind } from '@/types'

const KIND_LABELS: Record<MovementKind, string> = {
  sale: 'Sale',
  sale_return: 'Sale return',
  purchase: 'Purchase',
  purchase_return: 'Purchase return',
  adjustment_in: 'Adjustment in',
  adjustment_out: 'Adjustment out',
  transfer_out: 'Transfer out',
  transfer_in: 'Transfer in',
  reserve: 'Reserved',
  release: 'Reservation released',
  hold: 'Put on hold',
  hold_release: 'Hold released',
}

export function MovementTable({ movements }: { movements: Movement[] }) {
  if (movements.length === 0) {
    return (
      <div className="panel-body">
        <EmptyState icon={History} title="No movements yet" description="Sales, transfers, holds and corrections will appear here." />
      </div>
    )
  }

  return (
    <div className="table-wrap">
      <table className="card-table">
        <caption className="sr-only">Movement history, newest first</caption>
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">Movement</th>
            <th scope="col">Location</th>
            <th scope="col">Reference</th>
            <th scope="col" className="num">Units</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement) => (
            <tr key={movement.id}>
              <td className="card-title tabular">{formatRelativeDateTime(movement.at)}</td>
              <td data-label="Movement">
                {KIND_LABELS[movement.kind]}
                {movement.note && <small>{movement.note}</small>}
              </td>
              <td data-label="Location">{movement.branchName}</td>
              <td data-label="Reference" className="td-code">
                {movement.href ? (
                  <Link href={movement.href} className="link-cell">
                    {movement.reference}
                  </Link>
                ) : (
                  movement.reference
                )}
              </td>
              <td className="num tabular" data-label="Units">
                {formatSigned(movement.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
