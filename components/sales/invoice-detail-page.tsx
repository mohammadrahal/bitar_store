'use client'

import { ApiInvoiceDetailView } from '@/components/sales/api-invoice-detail-view'
import { ErrorState } from '@/components/shared/error-state'
import { Skeleton } from '@/components/shared/skeleton'
import { useApiInvoice } from '@/hooks/use-api-invoices'
import { isApiError } from '@/lib/api/api-error'

/** Server invoices from `GET /invoices/:id`. */
export function InvoiceDetailPage({ invoiceId }: { invoiceId: string }) {
  const api = useApiInvoice(invoiceId)

  if (api.isPending) return <Skeleton rows={1} stats={0} />

  if (api.data) return <ApiInvoiceDetailView invoiceId={invoiceId} />

  if (api.isError) {
    const api404 = isApiError(api.error) && api.error.status === 404
    const title = api404 ? 'Invoice not found' : 'Could not load this invoice'
    const hint = api404 ? (
      <>
        This id is not on the server, or your account cannot access the branch that issued it. B2C invoices come from a
        completed sale; B2B supply invoices come from a transfer. Create them via{' '}
        <strong>New sale</strong> or <strong>Transfers</strong>, not local storage.
      </>
    ) : undefined
    return (
      <ErrorState
        title={title}
        error={api.error}
        detail={hint}
        onRetry={() => {
          void api.refetch()
        }}
      />
    )
  }

  return <Skeleton rows={1} stats={0} />
}
