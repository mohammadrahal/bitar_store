'use client'

import Link from 'next/link'
import { ArrowRight, FileText, ScrollText } from 'lucide-react'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useCreateSupplyInvoice, useTransferSupplyInvoice } from '@/hooks/use-transfer-invoice'
import { invoiceLabel } from '@/services/invoices-api.service'
import type { ApiTransfer } from '@/lib/api/types'

export function TransferDocumentsPanel({
  transfer,
  canCreateSupplyInvoice,
  reportNoteRecorded,
  receivingSite,
  sendingSite,
}: {
  transfer: ApiTransfer
  canCreateSupplyInvoice: boolean
  /** A note came back on `transfer.receipts[]`, so the report has one to print. */
  reportNoteRecorded: boolean
  /** Viewer works at the destination branch (transfer to). */
  receivingSite: boolean
  /** Viewer works at the sender only (warehouse outbound). */
  sendingSite: boolean
}) {
  const show = transfer.status !== 'draft' && transfer.status !== 'cancelled'
  const invoiceQuery = useTransferSupplyInvoice(transfer.id, show, transfer.supplyInvoice)
  const createInvoice = useCreateSupplyInvoice()

  if (!show) return null

  const invoice = invoiceQuery.data
  const invoiceReady = Boolean(invoice && invoice.status === 'final' && !invoice.voided)
  const invoiceDraft = Boolean(invoice && invoice.status === 'draft')

  const destinationName = transfer.to.name

  const reportHint = reportNoteRecorded
    ? 'Inspector notes recorded · open to print'
    : receivingSite
      ? 'Write a note with the count; it is kept on the transfer'
      : 'Destination inspection record'

  /* None of these hold up receiving or confirming for sale: the supply invoice
     is finalized after the movement is reconciled (BL-03). */
  const invoiceHint = invoiceReady
    ? 'Finalized. Match quantities and prices'
    : invoiceDraft
      ? 'Draft. The warehouse finalizes it after the movement is reconciled'
      : invoice
        ? 'Open to review'
        : 'None raised. Dispatching from the warehouse raises the draft'

  return (
    <Panel
      className="transfer-documents-panel"
      title={receivingSite ? `Receiving at ${destinationName}` : sendingSite ? 'Outbound documents' : 'Report & invoice'}
      description={
        receivingSite
          ? `Transfer to ${destinationName}: after receive, complete the report and match the supply invoice before confirming for sale.`
          : sendingSite
            ? 'Raise and finalize the supply invoice for what was sent; the destination branch uses it when receiving.'
            : `Shipment to ${destinationName}. Receiving report and B2B supply invoice.`
      }
    >
      <ul className="doc-action-list panel-body">
        {(receivingSite || !sendingSite) && (
          <li>
            <Link href={`/transfers/${transfer.id}/report`} className="doc-action-link transfer-doc-row">
              <span className="transfer-doc-icon" aria-hidden="true">
                <ScrollText size={18} />
              </span>
              <span className="transfer-doc-copy">
                <span className="transfer-doc-title-row">
                  <strong>Receiving report · {destinationName}</strong>
                  <ArrowRight size={16} aria-hidden="true" className="transfer-doc-chevron" />
                </span>
                <small>{reportHint}</small>
              </span>
            </Link>
          </li>
        )}
        <li>
          {invoiceQuery.isPending ? (
            <Skeleton rows={1} stats={0} />
          ) : invoice ? (
            <Link href={`/sales/invoices/${invoice.id}`} className="doc-action-link transfer-doc-row">
              <span className="transfer-doc-icon" aria-hidden="true">
                <FileText size={18} />
              </span>
              <span className="transfer-doc-copy">
                <span className="transfer-doc-title-row">
                  <strong>Supply invoice · {invoiceLabel(invoice)}</strong>
                  <ArrowRight size={16} aria-hidden="true" className="transfer-doc-chevron" />
                </span>
                <small>{invoiceHint}</small>
              </span>
            </Link>
          ) : canCreateSupplyInvoice ? (
            <button
              type="button"
              className="doc-action-link transfer-doc-row"
              disabled={createInvoice.isPending}
              onClick={() => createInvoice.mutate({ transferId: transfer.id })}
            >
              <span className="transfer-doc-icon" aria-hidden="true">
                <FileText size={18} />
              </span>
              <span className="transfer-doc-copy">
                <span className="transfer-doc-title-row">
                  <strong>Create supply invoice</strong>
                  <ArrowRight size={16} aria-hidden="true" className="transfer-doc-chevron" />
                </span>
                <small>Raise the B2B invoice for what was sent on this transfer</small>
              </span>
            </button>
          ) : (
            <div className="doc-action-link transfer-doc-row doc-action-link--muted" aria-disabled="true">
              <span className="transfer-doc-icon" aria-hidden="true">
                <FileText size={18} />
              </span>
              <span className="transfer-doc-copy">
                <span className="transfer-doc-title-row">
                  <strong>Supply invoice</strong>
                </span>
                <small>{invoiceHint}</small>
              </span>
            </div>
          )}
        </li>
      </ul>
      {receivingSite && transfer.totals.onHold > 0 && (
        <p className="panel-body muted section-note">
          At {destinationName}, good stock on hold can be confirmed for sale now. Damaged pieces are never released,
          and the supply invoice is finalized by the warehouse afterwards.
        </p>
      )}
    </Panel>
  )
}
