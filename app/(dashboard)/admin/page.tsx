import { Suspense } from 'react'
import { AdminHubView } from '@/components/admin/admin-hub-view'
import { Skeleton } from '@/components/shared/skeleton'

export const metadata = { title: 'Admin' }

export default function AdminPage() {
  return (
    <Suspense fallback={<Skeleton rows={4} stats={2} />}>
      <AdminHubView />
    </Suspense>
  )
}
