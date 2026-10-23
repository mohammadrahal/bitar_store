import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Skeleton } from '@/components/dashboard/primitives'
import { ProductsView } from '@/components/views/products-view'

export const metadata: Metadata = { title: 'Products' }

export default function ProductsPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <ProductsView />
    </Suspense>
  )
}
