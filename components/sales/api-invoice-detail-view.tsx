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
import {
  draftUnitPrice,
  invoiceLabel,
  linesMissingPriceWithDraft,
  patchPayloadForMissingLines,
  priceSourceLabel,
} from '@/services/invoices-api.service'
import { toast } from 'sonner'
import { InvoiceLbpFootnote, InvoicePaymentAmount, invoicePaymentMethodLabel } from '@/components/sales/invoice-lbp'
import { PriceWithLbp } from '@/components/shared/price-with-lbp'
import { formatDocumentDate, formatPrice } from '@/lib/format'
import type { ApiInvoice } from '@/lib/api/types'
import { InvoiceLineBarcode } from '@/components/sales/invoice-line-barcode'
import { primaryBarcodeFor, useSkuBarcodes } from '@/hooks/use-sku-barcodes'

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
  const barcodeMap = useSkuBarcodes(invoice.lines.map((line) => line.sku.id))
  const showBarcode = invoice.kind === 'b2c'
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
  const rate = invoice.exchangeRate

  return (
    <div className="table-wrap">
      <table className="card-table card-table--invoice-detail">
        <thead>
          <tr>
            <th scope="col">Item</th>
            {showBarcode ? <th scope="col">Barcode</th> : null}
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
              className={
                showPriceSource && line.priceSource === 'missing' && draftUnitPrice(prices, line) === null
                  ? 'detail-alert'
                  : undefined
              }
            >
              <td className="card-title">
                {line.description}
                <small>
                  {showPriceSource && priceSourceLabel(line.priceSource)
                    ? `${line.sku.code} · ${priceSourceLabel(line.priceSource)}`
                    : line.sku.code}
                </small>
              </td>
              {showBarcode ? (
                <td className="invoice-line-barcode-cell">
                  <InvoiceLineBarcode
                    code={primaryBarcodeFor(
                      line.sku.id,
                      barcodeMap.data,
                      line.barcode ?? line.sku.barcode,
                    )}
                  />
                </td>
              ) : null}
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
                  <PriceWithLbp usd={Number(line.unitPrice)} exchangeRateUsdLbp={rate} />
                )}
              </td>
              <td className="num tabular">
                <PriceWithLbp usd={Number(line.lineTotal)} exchangeRateUsdLbp={rate} />
              </td>
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
  const canEdit = isDraftB2b && canDispatchTransfers()
  const note = noteDraft ?? invoice.note ?? ''
  const prices =
    priceDrafts ??
    Object.fromEntries(invoice.lines.map((line) => [line.sku.id, line.unitPrice]))
  const missingPrices = linesMissingPriceWithDraft(invoice, prices)

  const printPdf = async () => {
    const blob = await getApiClient().downloadInvoicePdf(invoice.id)
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  const saveDraft = async () => {
    const missingPatches = patchPayloadForMissingLines(invoice, prices)
    const lines = [
      ...missingPatches,
      ...invoice.lines
        .map((line) => {
          if (line.priceSource === 'missing') return null
          const unitPrice = draftUnitPrice(prices, line)
          if (!unitPrice || unitPrice === line.unitPrice.trim()) return null
          return { skuId: line.sku.id, unitPrice }
        })
        .filter(Boolean),
    ] as { skuId: string; unitPrice: string }[]
    const noteTrim = note.trim()
    const noteChanged = noteTrim !== (invoice.note ?? '').trim()
    if (lines.length === 0 && !noteChanged) {
      toast.error('Nothing to save — enter a unit price greater than zero on unpriced lines.')
      return
    }
    await updatePrices.mutateAsync({
      id: invoice.id,
      input: {
        ...(lines.length > 0 ? { lines } : {}),
        ...(noteChanged ? { note: noteTrim || undefined } : {}),
      },
    })
    setPriceDrafts(null)
  }

  const handleFinalize = async () => {
    if (missingPrices.length > 0) {
      toast.error('Enter a unit price greater than zero on every highlighted line first.')
      return
    }
    const pendingMissing = patchPayloadForMissingLines(invoice, prices)
    try {
      if (pendingMissing.length > 0) {
        await updatePrices.mutateAsync({ id: invoice.id, input: { lines: pendingMissing } })
        setPriceDrafts(null)
      }
      await finalize.mutateAsync(invoice.id)
    } catch {
      /* Errors are toasted in the mutation hooks. */
    }
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
                    disabled={updatePrices.isPending || finalize.isPending}
                    onClick={() => void saveDraft()}
                  >
                    {updatePrices.isPending ? 'Saving…' : 'Save draft'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={finalize.isPending || updatePrices.isPending || missingPrices.length > 0}
                    title={
                      missingPrices.length > 0
                        ? 'Enter a unit price greater than zero on every highlighted line'
                        : undefined
                    }
                    onClick={() => void handleFinalize()}
                  >
                    {finalize.isPending || updatePrices.isPending ? 'Finalizing…' : 'Finalize invoice'}
                  </button>
                </div>
              </>
            )}
            {isDraftB2b && missingPrices.length > 0 && (
              <p className="field-error" style={{ margin: 0 }}>
                {missingPrices.length === 1
                  ? `No purchase cost is known for ${missingPrices[0].sku.code}, so it is priced at ${formatPrice(0)}.`
                  : `No purchase cost is known for ${missingPrices.length} lines, so they are priced at ${formatPrice(0)}.`}{' '}
                {canEdit
                  ? 'Type a unit price greater than zero in the line above, then Save draft or Finalize (Finalize saves prices first).'
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
            <table className="card-table card-table--invoice-detail card-table--invoice-payment">
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
                    <td className="card-title">{invoicePaymentMethodLabel(payment)}</td>
                    <td className="num tabular">
                      <InvoicePaymentAmount payment={payment} exchangeRateUsdLbp={invoice.exchangeRate} />
                    </td>
                    <td>{payment.method === 'whish' ? '' : (payment.reference ?? '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      <Panel title="Totals">
        <div className="table-wrap">
          <table className="card-table card-table--invoice-detail card-table--invoice-totals">
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
                <td className="num tabular">
                  <PriceWithLbp usd={Number(invoice.subtotal)} exchangeRateUsdLbp={invoice.exchangeRate} />
                </td>
                <td className="num tabular">
                  <PriceWithLbp usd={Number(invoice.discountTotal)} exchangeRateUsdLbp={invoice.exchangeRate} />
                </td>
                <td className="num tabular card-table-total">
                  <PriceWithLbp
                    usd={Number(invoice.total)}
                    exchangeRateUsdLbp={invoice.exchangeRate}
                    lbpAmount={invoice.totalLbp}
                    strong
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="panel-body invoice-lbp-footnote-wrap">
          <InvoiceLbpFootnote exchangeRate={invoice.exchangeRate} />
        </div>
      </Panel>
    </>
  )
}
