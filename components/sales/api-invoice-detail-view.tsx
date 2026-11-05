'use client'

import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useApiInvoice } from '@/hooks/use-api-invoices'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { getApiClient } from '@/lib/api'
import { invoiceLabel } from '@/services/invoices-api.service'
import { formatDocumentDate, formatPrice } from '@/lib/format'
import type { ApiInvoice } from '@/lib/api/types'

function InvoiceLines({ invoice }: { invoice: ApiInvoice }) {
  return (
    <div className="table-wrap">
      <table className="card-table">
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col" className="num">
              Qty
            </th>
            <th scope="col" className="num">
              Unit
            </th>
            <th scope="col" className="num">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line) => (
            <tr key={line.lineNo}>
              <td className="card-title">
                {line.description}
                <small>{line.sku.code}</small>
              </td>
              <td className="num tabular">{line.quantity}</td>
              <td className="num tabular">{formatPrice(Number(line.unitPrice))}</td>
              <td className="num tabular">{formatPrice(Number(line.lineTotal))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ApiInvoiceDetailView({ invoiceId }: { invoiceId: string }) {
  const { data: invoice, isPending, isError, error, refetch } = useApiInvoice(invoiceId)
  useDocumentTitle(invoice ? invoiceLabel(invoice) : undefined)

  if (isPending) return <Skeleton rows={1} stats={0} />
  if (isError || !invoice) {
    return <ErrorState title="Could not load this invoice" error={error} onRetry={() => void refetch()} />
  }

  const reference = invoiceLabel(invoice)
  const customer = invoice.recipient.name ?? (invoice.kind === 'b2c' ? 'Walk-in customer' : '—')
  const backHref = invoice.sale ? `/sales/${invoice.sale.id}` : '/sales/b2c'

  const printPdf = async () => {
    const blob = await getApiClient().downloadInvoicePdf(invoice.id)
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  return (
    <>
      <Link href={backHref} className="back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        {invoice.sale ? `Sale ${invoice.sale.reference}` : 'Sales'}
      </Link>
      <PageHeader
        eyebrow={invoice.kind === 'b2c' ? 'Retail invoice' : 'Supply invoice'}
        title={reference}
        description={`${formatDocumentDate(invoice.finalizedAt ?? invoice.createdAt)} · ${customer}${invoice.note ? ` · ${invoice.note}` : ''}`}
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => void printPdf()}>
            <Printer size={16} aria-hidden="true" />
            Print invoice
          </button>
        }
      />
      <Panel title="Lines">
        <InvoiceLines invoice={invoice} />
      </Panel>
      {invoice.kind === 'b2c' && invoice.payments.length > 0 && (
        <Panel title="Payment">
          <div className="table-wrap">
            <table className="card-table">
              <thead>
                <tr>
                  <th scope="col">Method</th>
                  <th scope="col" className="num">
                    Amount
                  </th>
                  <th scope="col">Reference</th>
                </tr>
              </thead>
              <tbody>
                {invoice.payments.map((payment, index) => (
                  <tr key={index}>
                    <td className="card-title capitalize">{payment.method}</td>
                    <td className="num tabular">{formatPrice(Number(payment.amount))}</td>
                    <td>{payment.reference ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      <Panel title="Totals">
        <dl className="detail-grid-fields">
          <div>
            <dt>Subtotal</dt>
            <dd className="tabular">{formatPrice(Number(invoice.subtotal))}</dd>
          </div>
          <div>
            <dt>Discount</dt>
            <dd className="tabular">{formatPrice(Number(invoice.discountTotal))}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd className="tabular">{formatPrice(Number(invoice.total))}</dd>
          </div>
        </dl>
      </Panel>
    </>
  )
}
