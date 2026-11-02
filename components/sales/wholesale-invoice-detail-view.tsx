'use client'

import Link from 'next/link'
import { ArrowLeft, Pencil, Plus, Printer } from 'lucide-react'
import { printWholesaleInvoice } from '@/components/sales/sale-receipt-print'
import { ErrorState } from '@/components/shared/error-state'
import { Skeleton } from '@/components/shared/skeleton'
import { useBranches } from '@/hooks/use-branches'
import { useWholesaleInvoice } from '@/hooks/use-wholesale-invoices'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useCurrentUser } from '@/store/user-store'
import { formatDocumentDate, formatPrice } from '@/lib/format'
import { wholesaleInvoiceTotal, wholesaleReference } from '@/services/wholesale-invoices.service'

export function WholesaleInvoiceDetailView({ invoiceId }: { invoiceId: string }) {
  const user = useCurrentUser()
  const { data: branches } = useBranches()
  const { data: invoice, isPending, isError, error, refetch } = useWholesaleInvoice(invoiceId)
  useDocumentTitle(invoice ? wholesaleReference(invoice) : undefined)

  if (isPending) return <Skeleton rows={1} stats={0} />
  if (isError || !invoice) return <ErrorState title="Could not load this invoice" error={error} onRetry={() => void refetch()} />

  const branch = branches?.find((b) => b.id === invoice.branchId)
  const reference = wholesaleReference(invoice)
  const total = wholesaleInvoiceTotal(invoice)
  const units = invoice.lines.reduce((sum, line) => sum + line.quantity, 0)
  const when = invoice.issuedAt ?? invoice.createdAt

  const print = () => {
    printWholesaleInvoice({
      reference,
      status: invoice.status,
      customerName: invoice.customerName,
      issuedAt: when,
      sellerName: user.name,
      branchName: branch?.name,
      note: invoice.note,
      total,
      lines: invoice.lines.map((line) => ({
        label: line.label,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.quantity * line.unitPrice,
      })),
    })
  }

  return (
    <div className="invoice-page">
      <div className="invoice-page-toolbar">
        <Link href="/sales/invoices" className="back-link">
          <ArrowLeft size={16} aria-hidden="true" />
          Invoices
        </Link>
        <div className="invoice-page-actions">
          {invoice.status === 'draft' && (
            <Link href={`/sales/invoices/new?draft=${invoice.id}`} className="btn btn-secondary btn-sm">
              <Pencil size={16} aria-hidden="true" />
              Edit draft
            </Link>
          )}
          <Link href="/sales/invoices/new" className="btn btn-secondary btn-sm">
            <Plus size={16} aria-hidden="true" />
            New invoice
          </Link>
          <button type="button" className="btn btn-primary btn-sm" onClick={print}>
            <Printer size={16} aria-hidden="true" />
            Print
          </button>
        </div>
      </div>

      <article className="invoice-sheet invoice-sheet--readonly" aria-label="Wholesale invoice">
        <header className="invoice-sheet-header">
          <div className="invoice-from">
            <span className="invoice-logo brand-logo" aria-hidden="true">
              <span className="logo-full" />
            </span>
            <p className="invoice-from-name">Bitar Fashion</p>
            {branch && (
              <>
                <p>{branch.name}</p>
                {branch.code && <p className="invoice-muted">{branch.code}</p>}
              </>
            )}
          </div>
          <div className="invoice-title-block">
            <h1 className="invoice-title">Invoice</h1>
            <dl className="invoice-meta-list">
              <div>
                <dt>Invoice #</dt>
                <dd className="tabular">{reference}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{formatDocumentDate(when)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{invoice.status === 'draft' ? 'Draft' : 'Issued'}</dd>
              </div>
            </dl>
          </div>
        </header>

        <div className="invoice-parties">
          <section className="invoice-party invoice-party-bill-to">
            <h2>Bill to</h2>
            <p className="invoice-party-value">{invoice.customerName}</p>
          </section>
        </div>

        <div className="invoice-table-wrap">
          <table className="invoice-table">
            <thead>
              <tr>
                <th scope="col">Description</th>
                <th scope="col" className="num">
                  Qty
                </th>
                <th scope="col" className="num">
                  Unit price
                </th>
                <th scope="col" className="num">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line) => (
                <tr key={`${line.skuId}-${line.label}`}>
                  <td>{line.label}</td>
                  <td className="num tabular">{line.quantity}</td>
                  <td className="num tabular">{formatPrice(line.unitPrice)}</td>
                  <td className="num tabular">{formatPrice(line.quantity * line.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="invoice-sheet-footer">
          {invoice.note ? (
            <div className="invoice-notes">
              <h2>Notes</h2>
              <p className="invoice-party-value">{invoice.note}</p>
            </div>
          ) : (
            <div />
          )}
          <div className="invoice-totals">
            <dl>
              <div>
                <dt>Items</dt>
                <dd className="tabular">{units}</dd>
              </div>
              <div className="invoice-total-row">
                <dt>Total due</dt>
                <dd className="tabular">{formatPrice(total)}</dd>
              </div>
            </dl>
          </div>
        </footer>
      </article>
    </div>
  )
}
