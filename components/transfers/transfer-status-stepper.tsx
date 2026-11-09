import { Package, ShieldCheck, Truck } from 'lucide-react'
import { Stepper } from '@/components/ui/stepper'
import type { TransferStatus } from '@/lib/api/types'

const STEPS = [
  { id: 1, title: 'Prepare', icon: Package },
  { id: 2, title: 'In transit', icon: Truck },
  { id: 3, title: 'Receive & confirm', icon: ShieldCheck },
] as const

/** Map API status to linear step 1–3 for the progress UI (cancelled stays at preparation). */
function statusToStepperValue(status: TransferStatus): number {
  switch (status) {
    case 'draft':
    case 'cancelled':
      return 1
    case 'dispatched':
      return 2
    case 'partially_received':
    case 'received':
    case 'closed':
      return 3
    default:
      return 1
  }
}

export function TransferStatusStepper({
  status,
  className,
}: {
  status: TransferStatus
  className?: string
}) {
  const value = statusToStepperValue(status)
  const label =
    status === 'cancelled'
      ? 'Transfer cancelled (was not sent)'
      : 'Transfer progress'

  return (
    <Stepper
      value={value}
      steps={[...STEPS]}
      className={className}
      aria-label={label}
    />
  )
}
