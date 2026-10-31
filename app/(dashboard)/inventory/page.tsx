import { Suspense } from 'react'
import { InventoryView } from '@/components/inventory/inventory-view'
import { Skeleton } from '@/components/shared/skeleton'

export const metadata = { title: 'Inventory' }

export default function InventoryPage() {
  return (
    <Suspense fallback={<Skeleton rows={4} stats={5} />}>
      <InventoryView />
    </Suspense>
  )
}
