import { Suspense } from 'react'
import { InvoicesView } from '@/components/sales/invoices-view'
import { Skeleton } from '@/components/shared/skeleton'

export const metadata = { title: 'Invoices' }

export default function InvoicesPage() {
  return (
    <Suspense fallback={<Skeleton rows={1} stats={0} />}>
      <InvoicesView />
    </Suspense>
  )
}
