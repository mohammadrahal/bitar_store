import { TRANSFER_STATUS_LABELS } from '@/lib/transfers'
import type { TransferStatus } from '@/types'

const TONES: Record<TransferStatus, string> = {
  requested: 'pill-neutral',
  approved: 'pill-reserved',
  dispatched: 'pill-transit',
  partly_received: 'pill-low',
  closed: 'pill-healthy',
  cancelled: 'pill-archived',
}

export function TransferStatusPill({ status }: { status: TransferStatus }) {
  return (
    <span className={`pill ${TONES[status]}`}>
      <span className="pill-dot" aria-hidden="true" />
      {TRANSFER_STATUS_LABELS[status]}
    </span>
  )
}
