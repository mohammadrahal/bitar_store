'use client'

import { Skeleton } from '@/components/dashboard/primitives'
import { useInventory } from '@/components/inventory/inventory-provider'

/** Inventory lives in localStorage, so content renders only after client hydration. */
export function ReadyGate({ children }: { children: React.ReactNode }) {
  const { ready } = useInventory()
  return ready ? <>{children}</> : <Skeleton />
}
