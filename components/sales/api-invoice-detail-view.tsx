'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, Printer } from 'lucide-react'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useApiInvoice, useFinalizeInvoice, useUpdateInvoicePrices } from '@/hooks/use-api-invoices'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { usePermission } from '@/hooks/use-permission'
import { getApiClient } from '@/lib/api'
import { invoiceLabel, linesMissingPrice, priceSourceLabel } from '@/services/invoices-api.service'
import { formatDocumentDate, formatPrice } from '@/lib/format'
import type { ApiInvoice } from '@/lib/api/types'

function InvoiceLines({
  invoice,
  editable,
  prices,
  onPriceChange,
}: {
  invoice: ApiInvoice
  editable: boolean
  prices: Record<string, string>
  onPriceChange: (skuId: string, value: string) => void
}) {
  /*
   * Where a price came from is a **supply invoice** question.
   *
   * A b2b line is priced at the warehouse's cost, so `cost` / `manual` /
   * `missing` is the thing the warehouse has to see before finalizing. Every
   * b2c line answers `sale` — the price the customer actually paid — so
   * printing that under each SKU on a retail invoice is a label that tells the
   * reader nothing and clutters the row it sits in.
   */
  const showPriceSource = invoice.kind === 'b2b'

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
            <tr
              key={line.lineNo}
              className={showPriceSource && line.priceSource === 'missing' ? 'detail-alert' : undefined}
            >
              <td className="card-title">
                {line.description}
                <small>
                  {showPriceSource && priceSourceLabel(line.priceSource)
                    ? `${line.sku.code} · ${priceSourceLabel(line.priceSource)}`
                    : line.sku.code}
                </small>
              </td>
              <td className="num tabular">{line.quantity}</td>
              <td className="num tabular">
                {editable ? (
                  <input
                    type="text"
                    inputMode="decimal"
                    className="qty-input"
                    aria-label={`Unit price for ${line.sku.code}`}
                    value={prices[line.sku.id] ?? line.unitPrice}
                    onChange={(event) => onPriceChange(line.sku.id, event.target.value)}
                  />
                ) : (
                  formatPrice(Number(line.unitPrice))
                )}
              </td>
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
  const finalize = useFinalizeInvoice()
  const updatePrices = useUpdateInvoicePrices()
  const { canDispatchTransfers } = usePermission()
  const [noteDraft, setNoteDraft] = useState<string | null>(null)
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string> | null>(null)

  useDocumentTitle(invoice ? invoiceLabel(invoice) : undefined)

  if (isPending) return <Skeleton rows={1} stats={0} />
  if (isError || !invoice) {
    return <ErrorState title="Could not load this invoice" error={error} onRetry={() => void refetch()} />
  }

  const reference = invoiceLabel(invoice)
  const customer = invoice.recipient.name ?? (invoice.kind === 'b2c' ? 'Walk-in customer' : '')
  const backHref = invoice.transfer
    ? `/transfers/${invoice.transfer.id}`
    : invoice.sale
      ? `/sales/${invoice.sale.id}`
      : '/sales/b2c'

  const isDraftB2b = invoice.kind === 'b2b' && invoice.status === 'draft' && !invoice.voided
  const missingPrices = linesMissingPrice(invoice)
  const canEdit = isDraftB2b && canDispatchTransfers()
  const note = noteDraft ?? invoice.note ?? ''
  const prices =
    priceDrafts ??
    Object.fromEntries(invoice.lines.map((line) => [line.sku.id, line.unitPrice]))

  const printPdf = async () => {
    const blob = await getApiClient().downloadInvoicePdf(invoice.id)
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  const saveDraft = () => {
    const lines = invoice.lines
      .map((line) => {
        const raw = prices[line.sku.id] ?? line.unitPrice
        const unitPrice = raw.trim()
        if (!unitPrice || unitPrice === line.unitPrice) return null
        return { skuId: line.sku.id, unitPrice }
      })
      .filter(Boolean) as { skuId: string; unitPrice: string }[]
    const noteTrim = note.trim()
    const noteChanged = noteTrim !== (invoice.note ?? '').trim()
    if (lines.length === 0 && !noteChanged) return
    updatePrices.mutate({
      id: invoice.id,
      input: {
        ...(lines.length > 0 ? { lines } : {}),
        ...(noteChanged ? { note: noteTrim || undefined } : {}),
      },
    })
  }

  return (
    <>
      <Link href={backHref} className="back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        {invoice.transfer
          ? `Transfer ${invoice.transfer.reference}`
          : invoice.sale
            ? `Sale ${invoice.sale.reference}`
            : 'Sales'}
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

      {isDraftB2b && (
        <Panel
          title="Draft supply invoice"
          description="Finalize to assign a B2B number. The destination branch can then confirm received stock for sale."
        >
          <div className="panel-body stack gap-sm">
            {!canEdit ? (
              <p className="muted text-sm" style={{ margin: 0 }}>
                Only the warehouse (manager or admin) can edit prices and finalize. Open this invoice from the warehouse
                account, or ask them to finalize it.
              </p>
            ) : (
              <>
                <label className="field stack gap-xs">
                  <span className="field-label">Note</span>
                  <textarea
                    className="input"
                    rows={2}
                    value={note}
                    onChange={(event) => setNoteDraft(event.target.value)}
                  />
                </label>
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={updatePrices.isPending}
                    onClick={saveDraft}
                  >
                    {updatePrices.isPending ? 'Saving…' : 'Save draft'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={finalize.isPending || missingPrices.length > 0}
                    title={
                      missingPrices.length > 0
                        ? 'Set a price on every line first. The server refuses a draft with an unpriced line'
                        : undefined
                    }
                    onClick={() => finalize.mutate(invoice.id)}
                  >
                    {finalize.isPending ? 'Finalizing…' : 'Finalize invoice'}
                  </button>
                </div>
              </>
            )}
            {isDraftB2b && missingPrices.length > 0 && (
              <p className="field-error" style={{ margin: 0 }}>
                {missingPrices.length === 1
                  ? `No purchase cost is known for ${missingPrices[0].sku.code}, so it is priced at 0.00.`
                  : `No purchase cost is known for ${missingPrices.length} lines, so they are priced at 0.00.`}{' '}
                {canEdit
                  ? 'Type the price above and save the draft; the invoice cannot be finalized until you do.'
                  : 'A warehouse manager has to price them before this invoice can be finalized.'}
              </p>
            )}
            {invoice.transfer && (
              <p className="muted text-sm" style={{ margin: 0 }}>
                Linked to transfer{' '}
                <Link href={`/transfers/${invoice.transfer.id}`} className="text-link">
                  {invoice.transfer.reference}
                </Link>
                {invoice.transfer.id && (
                  <>
                    {' '}
                    and{' '}
                    <Link href={`/transfers/${invoice.transfer.id}/report`} className="text-link">
                      receiving report
                    </Link>
                  </>
                )}
                .
              </p>
            )}
          </div>
        </Panel>
      )}

      <Panel title="Lines">
        <InvoiceLines
          invoice={invoice}
          editable={canEdit}
          prices={prices}
          onPriceChange={(skuId, value) =>
            setPriceDrafts((current) => ({ ...(current ?? prices), [skuId]: value }))
          }
        />
        {canEdit ? (
          <p className="panel-body muted text-sm section-note">
            Adjust unit prices if needed, save the draft, then finalize. Prices on the catalog do not change.
          </p>
        ) : null}
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
                    <td>{payment.reference ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      <Panel title="Totals">
        <div className="table-wrap">
          <table className="card-table card-table--invoice-totals">
            <thead>
              <tr>
                <th scope="col" className="num">
                  Subtotal
                </th>
                <th scope="col" className="num">
                  Discount
                </th>
                <th scope="col" className="num">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="num tabular">{formatPrice(Number(invoice.subtotal))}</td>
                <td className="num tabular">{formatPrice(Number(invoice.discountTotal))}</td>
                <td className="num tabular card-table-total">{formatPrice(Number(invoice.total))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
