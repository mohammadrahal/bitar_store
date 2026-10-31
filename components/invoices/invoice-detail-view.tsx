'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCheck, Pencil, Printer, Send } from 'lucide-react'
import { InvoiceKindBadge, InvoiceStatusPill } from '@/components/invoices/invoice-badges'
import { InvoiceDangerZone } from '@/components/invoices/invoice-danger-zone'
import { InvoiceForm } from '@/components/invoices/invoice-form'
import { InvoiceLinesTable } from '@/components/invoices/invoice-lines-table'
import { InvoiceSummary } from '@/components/invoices/invoice-summary'
import { Can } from '@/components/shared/can'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { PreviewBadge } from '@/components/shared/preview-badge'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useDocumentTitle } from '@/hooks/use-document-title'
import {
  useDeleteInvoice,
  useInvoice,
  useIssueInvoice,
  useMarkInvoicePaid,
  useVoidInvoice,
} from '@/hooks/use-invoices'
import { usePermission } from '@/hooks/use-permission'
import { formatDocumentDate } from '@/lib/format'
import { invoiceTotals } from '@/lib/invoice-totals'
import {
  documentSubject,
  INVOICE_KIND_LABELS,
  INVOICE_PAYMENT_LABELS,
  isEditable,
  PARTY_LABELS,
  paymentMethodOf,
  pricedAtCost,
} from '@/lib/invoices'

type Dialog = 'edit' | 'void' | 'delete'

export function InvoiceDetailView({ invoiceId }: { invoiceId: string }) {
  const router = useRouter()
  const { canAccessLocation } = usePermission()
  const { data: invoice, isPending, isError, error, refetch } = useInvoice(invoiceId)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  useDocumentTitle(invoice?.number)

  const issue = useIssueInvoice()
  const markPaid = useMarkInvoicePaid()
  const voidDocument = useVoidInvoice()
  const remove = useDeleteInvoice()
  const busy = issue.isPending || markPaid.isPending || voidDocument.isPending || remove.isPending

  if (isPending) return <Skeleton rows={1} stats={0} />
  if (isError) return <ErrorState title="Could not load this document" error={error} onRetry={() => void refetch()} />

  // The document's branch is only known once it loads, so the check lands here.
  if (!canAccessLocation(invoice.branchId)) {
    return (
      <ErrorState
        title="Not your branch"
        error={new Error('This document belongs to another branch, so it is not available to you.')}
      />
    )
  }

  const totals = invoiceTotals(invoice.lines, invoice.discount)
  const showMargin = !pricedAtCost(invoice.kind) && !invoice.isInternal
  const paymentMethod = paymentMethodOf(invoice)

  return (
    <>
      <Link href="/invoices" className="text-btn back-link">
        <ArrowLeft size={14} aria-hidden="true" />
        All invoices
      </Link>

      <PreviewBadge feature="This document" />

      <PageHeader
        eyebrow={invoice.isInternal ? 'Transfer leg' : INVOICE_KIND_LABELS[invoice.kind]}
        title={invoice.number}
        description={`${PARTY_LABELS[invoice.kind]}: ${documentSubject(invoice)} · ${formatDocumentDate(invoice.issuedAt)}`}
        actions={
          <>
            {isEditable(invoice) && (
              <>
                <Can permission="documents.manage">
                  <button type="button" className="btn btn-secondary" onClick={() => setDialog('edit')} disabled={busy}>
                    <Pencil size={16} aria-hidden="true" />
                    Edit
                  </button>
                </Can>
                <Can permission="documents.manage">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => issue.mutate({ invoiceId })}
                    disabled={busy}
                  >
                    <Send size={16} aria-hidden="true" />
                    {issue.isPending ? 'Issuing…' : 'Issue'}
                  </button>
                </Can>
              </>
            )}
            {invoice.status === 'issued' && (
              <Can permission="documents.manage">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => markPaid.mutate({ invoiceId })}
                  disabled={busy}
                >
                  <CheckCheck size={16} aria-hidden="true" />
                  Mark paid
                </button>
              </Can>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
              <Printer size={16} aria-hidden="true" />
              Print
            </button>
          </>
        }
      />

      <div className="doc-meta">
        <InvoiceKindBadge kind={invoice.kind} isInternal={invoice.isInternal} />
        <InvoiceStatusPill status={invoice.status} />
        {paymentMethod && (
          <span className="muted">
            {INVOICE_PAYMENT_LABELS[paymentMethod]}
            {paymentMethod === 'whish' && invoice.whishReference ? ` · ${invoice.whishReference}` : ''}
          </span>
        )}
        {invoice.status === 'draft' && <span className="muted">Nothing has moved yet.</span>}
        {invoice.transferId && (
          <Link href={`/transfers/${invoice.transferId}`} className="link-row">
            Raised by a transfer. View transfer
          </Link>
        )}
      </div>

      <Panel
        title="Lines"
        description={`${invoice.lines.length} ${invoice.lines.length === 1 ? 'line' : 'lines'} · ${totals.units} units`}
      >
        <InvoiceLinesTable lines={invoice.lines} />
        <div className="panel-body">
          <InvoiceSummary totals={totals} showMargin={showMargin} />
        </div>
      </Panel>

      {invoice.notes && (
        <Panel title="Notes">
          <div className="panel-body">
            <p className="muted">{invoice.notes}</p>
          </div>
        </Panel>
      )}

      {!invoice.transferId && (
        <InvoiceDangerZone
          invoice={invoice}
          busy={busy}
          onVoid={() => setDialog('void')}
          onDelete={() => setDialog('delete')}
        />
      )}

      {dialog === 'edit' && (
        <InvoiceForm invoice={invoice} defaultBranchId={invoice.branchId} onClose={() => setDialog(null)} />
      )}
      {dialog === 'void' && (
        <ConfirmDialog
          title={`Void ${invoice.number}?`}
          description={`This reverses ${totals.units} units against ${documentSubject(invoice)} and cannot be undone. The document stays on file.`}
          confirmLabel="Void invoice"
          tone="danger"
          onResolve={(confirmed) => {
            setDialog(null)
            if (confirmed) voidDocument.mutate({ invoiceId })
          }}
        />
      )}
      {dialog === 'delete' && (
        <ConfirmDialog
          title={`Delete ${invoice.number}?`}
          description="This draft has not moved any stock. Deleting it removes it for good."
          confirmLabel="Delete invoice"
          tone="danger"
          onResolve={(confirmed) => {
            setDialog(null)
            // The page it was opened from is gone once the draft is, so leave it.
            if (confirmed) {
              remove.mutate({ invoiceId, number: invoice.number }, { onSuccess: () => router.replace('/invoices') })
            }
          }}
        />
      )}
    </>
  )
}
