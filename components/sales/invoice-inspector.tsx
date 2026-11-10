'use client'

import Link from 'next/link'
import { Download, ExternalLink, MessageCircle, Printer, X } from 'lucide-react'
import { InvoiceLedgerStatusPill } from '@/components/shared/status-pill'
import { InvoicePaymentAmount, invoicePaymentMethodLabel } from '@/components/sales/invoice-lbp'
import { PriceWithLbp } from '@/components/shared/price-with-lbp'
import { Skeleton } from '@/components/shared/skeleton'
import { useApiInvoice, useVoidInvoice } from '@/hooks/use-api-invoices'
import { useBranches } from '@/hooks/use-branches'
import { getApiClient } from '@/lib/api'
import { ledgerDisplayStatus, ledgerStatusLabel } from '@/lib/invoices-ledger'
import { formatDocumentDate, formatPrice } from '@/lib/format'
import type { ApiInvoicePayment } from '@/lib/api/types'
import { invoiceLabel, invoiceTotal } from '@/services/invoices-api.service'

function InspectorReceipt({
  reference,
  status,
  customer,
  branchName,
  at,
  lines,
  subtotal,
  discount,
  total,
  payments,
  exchangeRate,
  totalLbp,
}: {
  reference: string
  status: string
  customer: string
  branchName?: string
  at: string
  lines: { label: string; sku?: string; quantity: number; lineTotal: number }[]
  subtotal: number
  discount: number
  total: number
  exchangeRate?: number | null
  totalLbp?: number | null
  payments?: { payment: ApiInvoicePayment }[]
}) {
  return (
    <div className="invoice-inspector-receipt">
      <header className="invoice-inspector-receipt-head">
        <p className="invoice-inspector-brand">Bitar</p>
        {branchName ? <p className="muted text-sm">{branchName}</p> : null}
      </header>
      <dl className="invoice-inspector-meta detail-grid-fields detail-grid-fields--2">
        <div>
          <dt>Billed client</dt>
          <dd>{customer || 'Walk-in customer'}</dd>
        </div>
        <div>
          <dt>Issued</dt>
          <dd>{formatDocumentDate(at)}</dd>
        </div>
      </dl>
      <table className="invoice-inspector-lines">
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col" className="num">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={`${line.label}-${index}`}>
              <td>
                <span className="invoice-inspector-line-title">{line.label}</span>
                {line.sku ? <small className="muted">{line.sku}</small> : null}
                {line.quantity > 1 ? <small className="muted"> × {line.quantity}</small> : null}
              </td>
              <td className="num tabular">
                <PriceWithLbp usd={line.lineTotal} exchangeRateUsdLbp={exchangeRate} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="invoice-inspector-totals totals">
        <dt>Subtotal</dt>
        <dd className="tabular">
          <PriceWithLbp usd={subtotal} exchangeRateUsdLbp={exchangeRate} />
        </dd>
        {discount > 0 ? (
          <>
            <dt>Discounts</dt>
            <dd className="tabular tone-good">
              −<PriceWithLbp usd={discount} exchangeRateUsdLbp={exchangeRate} />
            </dd>
          </>
        ) : null}
        <dt>Net total</dt>
        <dd className="tabular invoice-inspector-grand">
          <PriceWithLbp usd={total} exchangeRateUsdLbp={exchangeRate} lbpAmount={totalLbp} strong />
        </dd>
      </dl>
      {payments && payments.length > 0 ? (
        <section className="invoice-inspector-payments">
          <h3 className="invoice-inspector-section-title">Payment</h3>
          <ul className="invoice-inspector-payment-list">
            {payments.map((row, index) => (
              <li key={`${row.payment.method}-${index}`}>
                <span>{invoicePaymentMethodLabel(row.payment)}</span>
                <span className="tabular">
                  <InvoicePaymentAmount payment={row.payment} exchangeRateUsdLbp={exchangeRate} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="invoice-inspector-foot muted text-xs">
        {reference} · {status}
      </p>
    </div>
  )
}

export function InvoiceInspector({ invoiceId, onClose }: { invoiceId: string; onClose: () => void }) {
  const { data: branches } = useBranches()
  const voidInvoice = useVoidInvoice()
  const api = useApiInvoice(invoiceId)

  const printPdf = async (id: string) => {
    const blob = await getApiClient().downloadInvoicePdf(id)
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  const whatsAppShare = (text: string) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  if (api.isPending) {
    return (
      <aside className="invoice-inspector" aria-label="Invoice inspector">
        <Skeleton rows={1} stats={0} />
      </aside>
    )
  }

  if (!api.data) {
    return (
      <aside className="invoice-inspector" aria-label="Invoice inspector">
        <p className="muted">Could not load this invoice.</p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          Close
        </button>
      </aside>
    )
  }

  const invoice = api.data
  const status = ledgerDisplayStatus(invoice)
  const reference = invoiceLabel(invoice)
  const branchName = branches?.find((b) => b.id === (invoice.recipient.branchId ?? ''))?.name
  const customer = invoice.recipient.name ?? (invoice.kind === 'b2c' ? 'Walk-in customer' : '')
  const subtotal = Number(invoice.subtotal)
  const discount = Number(invoice.discountTotal)
  const total = invoiceTotal(invoice)
  const payments = invoice.payments?.map((payment) => ({ payment }))

  return (
    <aside className="invoice-inspector" aria-label="Invoice inspector">
      <header className="invoice-inspector-head">
        <div>
          <p className="eyebrow">Invoice inspector</p>
          <h2 className="invoice-inspector-title">
            {reference}
            <InvoiceLedgerStatusPill status={status} label={ledgerStatusLabel(status)} />
          </h2>
        </div>
        <div className="invoice-inspector-head-actions">
          <Link href={`/sales/invoices/${invoice.id}`} className="icon-btn" title="Open full page">
            <ExternalLink size={16} aria-hidden="true" />
            <span className="sr-only">Open full page</span>
          </Link>
          <button type="button" className="icon-btn" title="Print" onClick={() => void printPdf(invoice.id)}>
            <Printer size={16} aria-hidden="true" />
            <span className="sr-only">Print</span>
          </button>
          <button type="button" className="icon-btn" title="Download PDF" onClick={() => void printPdf(invoice.id)}>
            <Download size={16} aria-hidden="true" />
            <span className="sr-only">Download</span>
          </button>
          <button type="button" className="icon-btn" title="Close inspector" onClick={onClose}>
            <X size={16} aria-hidden="true" />
            <span className="sr-only">Close</span>
          </button>
        </div>
      </header>

      <InspectorReceipt
        reference={reference}
        status={ledgerStatusLabel(status)}
        customer={customer}
        branchName={branchName}
        at={invoice.finalizedAt ?? invoice.createdAt}
        lines={invoice.lines.map((line) => ({
          label: line.description,
          sku: line.sku.code,
          quantity: line.quantity,
          lineTotal: Number(line.lineTotal),
        }))}
        subtotal={subtotal}
        discount={discount}
        total={total}
        exchangeRate={invoice.exchangeRate}
        totalLbp={invoice.totalLbp}
        payments={payments}
      />

      <footer className="invoice-inspector-actions">
        <button
          type="button"
          className="btn btn-secondary invoice-inspector-wa"
          onClick={() => whatsAppShare(`${reference} · ${formatPrice(total)} from Bitar Fashion. ${customer}`)}
        >
          <MessageCircle size={16} aria-hidden="true" />
          WhatsApp receipt
        </button>
        {status === 'paid' && !invoice.voided ? (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={voidInvoice.isPending}
            onClick={() => {
              const reason = window.prompt('Reason for voiding this invoice?')
              if (!reason?.trim()) return
              voidInvoice.mutate({ id: invoice.id, reason: reason.trim() })
            }}
          >
            Refund or void
          </button>
        ) : null}
        <button type="button" className="btn btn-primary" onClick={() => void printPdf(invoice.id)}>
          <Printer size={16} aria-hidden="true" />
          Print
        </button>
      </footer>
    </aside>
  )
}
