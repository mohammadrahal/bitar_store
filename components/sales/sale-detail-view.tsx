'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Copy,
  Download,
  MessageCircle,
  Phone,
  Printer,
  User,
} from 'lucide-react'
import { printSaleReceipt } from '@/components/sales/sale-receipt-print'
import { receiptFromSale } from '@/components/sales/sale-receipt-build'
import { PriceWithLbp } from '@/components/shared/price-with-lbp'
import { ErrorState } from '@/components/shared/error-state'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { Pagination } from '@/components/shared/pagination'
import { usePagination } from '@/hooks/use-pagination'
import { useBranches } from '@/hooks/use-branches'
import { useSale } from '@/hooks/use-sales'
import { getApiClient } from '@/lib/api'
import type { ApiSale, ApiSaleLine } from '@/lib/api/types'
import { formatPrice, formatNumber } from '@/lib/format'
import { queryKeys } from '@/lib/query-keys'
import { salePaymentKind } from '@/lib/sale-payments'
import { findB2cInvoiceForSale, invoiceLabel } from '@/services/invoices-api.service'
import { usdToLbp } from '@/services/settings.service'
import { useExchangeRate } from '@/hooks/use-settings'

function formatSaleWhen(iso: string) {
  const date = new Date(iso)
  const day = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
  const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date)
  return `${day} · ${time}`
}

function channelLabel(sale: ApiSale) {
  if (sale.channel === 'social_media') {
    return sale.socialPlatform ? `Social · ${sale.socialPlatform}` : 'Social'
  }
  return 'In store'
}

function paymentStatusLabel(sale: ApiSale) {
  const kind = salePaymentKind(sale.payments)
  const method =
    kind === 'split' ? 'Cash + Whish' : kind === 'whish' ? 'Whish' : 'Cash'
  return `Paid in full (${method} ${sale.currency})`
}

function lineDiscountText(line: ApiSaleLine) {
  if (!line.discount) return '0% / $0.00'
  if (line.discount.type === 'percent') return `${line.discount.percent}% / —`
  return 'Override / —'
}

function whatsAppHref(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return digits ? `https://wa.me/${digits}` : null
}

function SaleLinesTable({ lines, subtotal, discount, total }: {
  lines: ApiSale['lines']
  subtotal: number
  discount: number
  total: number
}) {
  const rateQuery = useExchangeRate()
  const lbpTotal = usdToLbp(total, rateQuery.rate)
  const { visible, page, pageCount, total: rowTotal, pageSize, setPage } = usePagination(lines, 15)

  return (
    <>
      <div className="table-wrap">
        <table className="card-table sale-invoice-lines-table">
          <thead>
            <tr>
              <th scope="col">Item &amp; details</th>
              <th scope="col">SKU</th>
              <th scope="col" className="num">
                Qty
              </th>
              <th scope="col" className="num">
                Unit price
              </th>
              <th scope="col" className="num">
                Tax / disc
              </th>
              <th scope="col" className="num">
                Line total
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((line) => (
              <tr key={line.lineNo}>
                <td className="card-title">
                  {line.styleName} {line.color} / {line.size}
                </td>
                <td className="td-code tabular">{line.skuCode}</td>
                <td className="num tabular">{formatNumber(line.quantity)}</td>
                <td className="num tabular">
                  <PriceWithLbp usd={Number(line.unitPrice)} />
                </td>
                <td className="num tabular sale-invoice-disc">{lineDiscountText(line)}</td>
                <td className="num tabular">
                  <PriceWithLbp usd={Number(line.lineTotal)} strong />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageCount={pageCount} total={rowTotal} pageSize={pageSize} onPage={setPage} />
      <div className="sale-invoice-lines-foot panel-body">
        <dl className="sale-invoice-totals">
          <div>
            <dt>Subtotal</dt>
            <dd className="tabular">{formatPrice(subtotal)}</dd>
          </div>
          <div>
            <dt>Tax (0%)</dt>
            <dd className="tabular">{formatPrice(0)}</dd>
          </div>
          <div>
            <dt>Discount</dt>
            <dd className="tabular">{discount > 0 ? formatPrice(discount) : formatPrice(0)}</dd>
          </div>
          <div className="sale-invoice-totals-net">
            <dt>Net total</dt>
            <dd>
              <PriceWithLbp usd={total} strong />
              {lbpTotal !== null ? (
                <span className="sale-invoice-totals-lbp muted tabular">≈ {formatNumber(lbpTotal)} LBP</span>
              ) : null}
            </dd>
          </div>
        </dl>
      </div>
    </>
  )
}

export function SaleDetailView({ saleId }: { saleId: string }) {
  const { data: sale, isPending, isError, error, refetch } = useSale(saleId)
  const { data: branches } = useBranches()
  const invoiceQuery = useQuery({
    queryKey: [...queryKeys.apiInvoices.all, 'for-sale', saleId, sale?.reference ?? ''],
    queryFn: () => findB2cInvoiceForSale(saleId),
    enabled: Boolean(sale?.reference),
  })

  useDocumentTitle(sale?.reference)

  if (isPending) return <Skeleton rows={1} stats={0} />
  if (isError || !sale) return <ErrorState title="Could not load this sale" error={error} onRetry={() => void refetch()} />

  const branchName = branches?.find((branch) => branch.id === sale.branchId)?.name ?? 'Branch'
  const invoice = invoiceQuery.data
  const customerName =
    sale.customerName?.trim() ||
    invoice?.recipient.name?.trim() ||
    (sale.channel === 'in_store' ? 'Walk-in customer' : 'Customer')
  const customerPhone = sale.customerPhone?.trim() || invoice?.recipient.phone?.trim() || ''
  const fiscalRef = invoice ? invoiceLabel(invoice) : null
  const subtotal = Number(sale.subtotal) || 0
  const discount = Number(sale.totalDiscount) || 0
  const total = Number(sale.total) || 0
  const waHref = customerPhone ? whatsAppHref(customerPhone) : null

  const printReceipt = () =>
    printSaleReceipt({
      ...receiptFromSale(sale),
      branchName,
      customerName: customerName !== 'Walk-in customer' ? customerName : undefined,
    })

  const downloadPdf = async () => {
    if (!invoice) return
    const blob = await getApiClient().downloadInvoicePdf(invoice.id)
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  return (
    <div className="sale-invoice-page">
      <Link href="/sales/b2c" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        Sales
      </Link>

      <header className="sale-invoice-hero">
        <div className="sale-invoice-hero-main">
          <p className="sale-invoice-ref tabular">{sale.reference}</p>
          <div className="sale-invoice-hero-title-row">
            <p className="sale-invoice-total tabular">
              <PriceWithLbp usd={total} strong />
            </p>
            <span className="sale-invoice-channel">{channelLabel(sale)}</span>
          </div>
          <span className="sale-invoice-status-pill">{paymentStatusLabel(sale)}</span>
          <p className="sale-invoice-meta muted">
            {formatSaleWhen(sale.soldAt)}
            <span aria-hidden="true"> · </span>
            {branchName}
            <span aria-hidden="true"> · </span>
            {sale.soldBy.name ?? 'Staff'}
            {fiscalRef ? (
              <>
                <span aria-hidden="true"> · </span>
                Fiscal{' '}
                <Link href={`/sales/invoices/${invoice!.id}`} className="text-link">
                  {fiscalRef}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <div className="sale-invoice-hero-actions">
          <button type="button" className="btn btn-secondary" onClick={printReceipt}>
            <Printer size={16} aria-hidden="true" />
            Print receipt
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!invoice}
            onClick={() => void downloadPdf()}
          >
            <Download size={16} aria-hidden="true" />
            Download PDF
          </button>
          {waHref ? (
            <a href={waHref} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
              <MessageCircle size={16} aria-hidden="true" />
              WhatsApp
            </a>
          ) : null}
          <Link href="/sales/new" className="btn btn-secondary">
            <Copy size={16} aria-hidden="true" />
            New sale
          </Link>
        </div>
      </header>

      <p className="sale-invoice-client muted">
        Client: <strong>{customerName}</strong>
      </p>

      <Panel title="Customer dossier" className="sale-invoice-section">
        <dl className="sale-dossier-grid panel-body">
          <div>
            <dt>
              <User size={14} aria-hidden="true" />
              Full name
            </dt>
            <dd>{customerName}</dd>
          </div>
          <div>
            <dt>
              <Phone size={14} aria-hidden="true" />
              Phone number
            </dt>
            <dd className="tabular">{customerPhone || '—'}</dd>
          </div>
          <div>
            <dt>Customer tier</dt>
            <dd>{sale.channel === 'in_store' ? 'Regular · in-store client' : 'Social client'}</dd>
          </div>
          <div>
            <dt>Billing location</dt>
            <dd>{branchName}</dd>
          </div>
        </dl>
      </Panel>

      <Panel
        title={`Lines (${formatNumber(sale.lines.length)} ${sale.lines.length === 1 ? 'item' : 'items'})`}
        className="sale-invoice-section"
      >
        <SaleLinesTable lines={sale.lines} subtotal={subtotal} discount={discount} total={total} />
      </Panel>

      <Panel
        title="Payment"
        className="sale-invoice-section"
        actions={<span className="sale-invoice-paid-pill">Paid in full</span>}
      >
        <div className="table-wrap">
          <table className="card-table">
            <thead>
              <tr>
                <th scope="col">Method</th>
                <th scope="col" className="num">
                  Amount
                </th>
                <th scope="col" className="num">
                  Tendered
                </th>
                <th scope="col" className="num">
                  Change
                </th>
                <th scope="col">Reference</th>
              </tr>
            </thead>
            <tbody>
              {sale.payments.map((payment, index) => (
                <tr key={index}>
                  <td className="card-title capitalize">{payment.method}</td>
                  <td className="num tabular">{formatPrice(Number(payment.amount))}</td>
                  <td className="num tabular">
                    {payment.tendered != null ? formatPrice(Number(payment.tendered)) : '—'}
                  </td>
                  <td className="num tabular sale-invoice-change">
                    {payment.change != null && Number(payment.change) > 0
                      ? formatPrice(Number(payment.change))
                      : '—'}
                  </td>
                  <td className="tabular">{payment.reference ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
