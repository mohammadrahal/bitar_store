import { HydrationGate } from '@/components/shared/hydration-gate'
import { RootRedirect } from '@/components/shared/root-redirect'

export default function HomePage() {
  return (
    <HydrationGate fallback={null}>
      <RootRedirect />
    </HydrationGate>
  )
}
