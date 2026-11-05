'use client'

import { ApiInvoiceDetailView } from '@/components/sales/api-invoice-detail-view'
import { WholesaleInvoiceDetailView } from '@/components/sales/wholesale-invoice-detail-view'
import { ErrorState } from '@/components/shared/error-state'
import { Skeleton } from '@/components/shared/skeleton'
import { useApiInvoice } from '@/hooks/use-api-invoices'
import { useWholesaleInvoice } from '@/hooks/use-wholesale-invoices'
import { ApiError } from '@/lib/api'

/** Server invoices (UUID) first; local wholesale drafts share the same URL shape. */
export function InvoiceDetailPage({ invoiceId }: { invoiceId: string }) {
  const api = useApiInvoice(invoiceId)
  const wholesale = useWholesaleInvoice(invoiceId)

  if (api.isPending && wholesale.isPending) return <Skeleton rows={1} stats={0} />

  if (api.data) return <ApiInvoiceDetailView invoiceId={invoiceId} />

  if (wholesale.data) return <WholesaleInvoiceDetailView invoiceId={invoiceId} />

  if (api.isError && wholesale.isError) {
    const missing =
      api.error instanceof ApiError && api.error.status === 404 && wholesale.error?.message === 'Invoice not found'
    return (
      <ErrorState
        title={missing ? 'Invoice not found' : 'Could not load this invoice'}
        error={api.error ?? wholesale.error}
        onRetry={() => {
          void api.refetch()
          void wholesale.refetch()
        }}
      />
    )
  }

  return <Skeleton rows={1} stats={0} />
}
