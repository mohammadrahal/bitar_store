import { Suspense } from 'react'
import { SuppliersView } from '@/components/suppliers/suppliers-view'
import { Skeleton } from '@/components/shared/skeleton'

export const metadata = { title: 'Suppliers' }

export default function SuppliersPage() {
  return (
    <Suspense fallback={<Skeleton rows={4} stats={0} />}>
      <SuppliersView />
    </Suspense>
  )
}
