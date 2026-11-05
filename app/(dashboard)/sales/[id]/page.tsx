import { Suspense } from 'react'
import { SaleDetailView } from '@/components/sales/sale-detail-view'
import { Skeleton } from '@/components/shared/skeleton'

export const metadata = { title: 'Sale' }

export default async function SalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense fallback={<Skeleton rows={1} stats={0} />}>
      <SaleDetailView saleId={id} />
    </Suspense>
  )
}
