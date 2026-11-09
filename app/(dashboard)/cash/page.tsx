import { Suspense } from 'react'
import { CashHubView } from '@/components/cash/cash-hub-view'
import { Skeleton } from '@/components/shared/skeleton'

export const metadata = { title: 'Cash drawer' }

export default function CashPage() {
  return (
    <Suspense fallback={<Skeleton rows={4} stats={4} />}>
      <CashHubView />
    </Suspense>
  )
}
