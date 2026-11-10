import { Suspense } from 'react'
import { ReturnsHubView } from '@/components/returns/returns-hub-view'
import { Skeleton } from '@/components/shared/skeleton'

export const metadata = { title: 'Returns' }

export default function ReturnsPage() {
  return (
    <Suspense fallback={<Skeleton rows={4} stats={0} />}>
      <ReturnsHubView />
    </Suspense>
  )
}
