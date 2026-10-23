import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Skeleton } from '@/components/dashboard/primitives'
import { MovementsView } from '@/components/views/movements-view'

export const metadata: Metadata = { title: 'Stock movements' }

export default function MovementsPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <MovementsView />
    </Suspense>
  )
}
