'use client'

import Link from 'next/link'
import { ReceiptText } from 'lucide-react'
import { InvoiceKindBadge, InvoiceStatusPill } from '@/components/invoices/invoice-badges'
import { Can } from '@/components/shared/can'
import type { Permission } from '@/lib/permissions'
import { EmptyState } from '@/components/shared/empty-state'
import { formatDocumentDate, formatPrice } from '@/lib/format'
import { documentSubject } from '@/lib/invoices'
import type { InvoiceRow } from '@/types'

export function InvoiceTable({
  invoices,
  filtered,
  showBranch,
  onCreate,
  createPermission = 'documents.manage',
  emptyTitle = 'No documents yet',
  emptyDescription = 'Raise a sale at the till or record a supplier purchase to start the ledger.',
  emptyActionLabel = 'New document',
}: {
  invoices: InvoiceRow[]
  /** True when a filter is narrowing the list, which changes the empty copy. */
  filtered: boolean
  /** Hidden for branch-scoped roles, where every row is the same branch. */
  showBranch: boolean
  onCreate: () => void
  createPermission?: Permission
  emptyTitle?: string
  emptyDescription?: string
  emptyActionLabel?: string
}) {
  if (invoices.length === 0) {
    return (
      <div className="panel-body">
        {filtered ? (
          <EmptyState
            icon={ReceiptText}
            title="No documents match"
            description="Try another search term, or clear the kind and status filters."
          />
        ) : (
          <EmptyState
            icon={ReceiptText}
            title={emptyTitle}
            description={emptyDescription}
            action={
              <Can permission={createPermission}>
                <button type="button" className="btn btn-primary" onClick={onCreate}>
                  {emptyActionLabel}
                </button>
              </Can>
            }
          />
        )}
      </div>
    )
  }

  return (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">Sales, purchases and returns</caption>
        <thead>
          <tr>
            <th scope="col">Document</th>
            <th scope="col">Kind</th>
            {showBranch && <th scope="col">Branch</th>}
            <th scope="col">Party</th>
            <th scope="col" className="num">
              Units
            </th>
            <th scope="col" className="num">
              Total
            </th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td>
                <Link href={`/invoices/${invoice.id}`} className="link-cell">
                  <strong>{invoice.number}</strong>
                </Link>
                <small>{formatDocumentDate(invoice.issuedAt)}</small>
              </td>
              <td>
                <InvoiceKindBadge kind={invoice.kind} isInternal={invoice.isInternal} />
              </td>
              {showBranch && <td>{invoice.branchName}</td>}
              <td>
                <strong>{documentSubject(invoice)}</strong>
                <small>
                  {invoice.lineCount} {invoice.lineCount === 1 ? 'line' : 'lines'}
                </small>
              </td>
              <td className="num tabular">{invoice.units}</td>
              <td className="num tabular">{formatPrice(invoice.total)}</td>
              <td>
                <InvoiceStatusPill status={invoice.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
