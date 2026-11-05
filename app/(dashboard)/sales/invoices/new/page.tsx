import { Suspense } from 'react'
import { NewWholesaleInvoiceView } from '@/components/sales/new-wholesale-invoice-view'
import { Skeleton } from '@/components/shared/skeleton'

export const metadata = { title: 'New wholesale invoice' }

export default function NewWholesaleInvoicePage() {
  return (
    <Suspense fallback={<Skeleton rows={1} stats={0} />}>
      <NewWholesaleInvoiceView />
    </Suspense>
  )
}
