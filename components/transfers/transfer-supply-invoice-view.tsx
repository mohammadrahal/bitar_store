'use client'

import Link from 'next/link'
import { ArrowLeft, FileText } from 'lucide-react'
import { ApiInvoiceDetailView } from '@/components/sales/api-invoice-detail-view'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Skeleton } from '@/components/shared/skeleton'
import { useTransferSupplyInvoice } from '@/hooks/use-transfer-invoice'
import { useTransfer } from '@/hooks/use-transfers'

/** Supply invoice in transfer context — reachable without the invoices ledger. */
export function TransferSupplyInvoiceView({ transferId }: { transferId: string }) {
  const transfer = useTransfer(transferId)
  const showInvoice = Boolean(transfer.data && transfer.data.status !== 'draft' && transfer.data.status !== 'cancelled')
  const invoiceQuery = useTransferSupplyInvoice(transferId, showInvoice, transfer.data?.supplyInvoice)

  if (transfer.isPending || (showInvoice && invoiceQuery.isPending)) {
    return <Skeleton rows={6} stats={0} />
  }

  if (transfer.isError || !transfer.data) {
    return <ErrorState title="Transfer unavailable" error={transfer.error} onRetry={() => void transfer.refetch()} />
  }

  const invoiceId = invoiceQuery.data?.id ?? transfer.data.supplyInvoice?.id ?? null

  if (invoiceQuery.isError) {
    return (
      <>
        <Link href={`/transfers/${transferId}`} className="back-link">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to transfer
        </Link>
        <ErrorState title="Could not load supply invoice" error={invoiceQuery.error} onRetry={() => void invoiceQuery.refetch()} />
      </>
    )
  }

  if (!invoiceId) {
    return (
      <>
        <Link href={`/transfers/${transferId}`} className="back-link">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to transfer
        </Link>
        <EmptyState
          icon={FileText}
          title="No supply invoice yet"
          description="Dispatching from the warehouse usually raises one automatically. The warehouse can also create it from the transfer."
        />
      </>
    )
  }

  return <ApiInvoiceDetailView invoiceId={invoiceId} />
}
