import type { TransferStatus } from '@/lib/api/types'

const LABEL: Record<TransferStatus, string> = {
  draft: 'Draft',
  dispatched: 'On the road',
  partially_received: 'Partly received',
  received: 'Received',
  closed: 'Closed',
  cancelled: 'Cancelled',
}

const TONE: Record<TransferStatus, string> = {
  draft: 'pill-neutral',
  dispatched: 'pill-low',
  partially_received: 'pill-low',
  received: 'pill-healthy',
  closed: 'pill-neutral',
  cancelled: 'pill-out',
}

export function TransferStatusPill({ status }: { status: TransferStatus }) {
  return (
    <span className={`pill ${TONE[status] ?? 'pill-neutral'}`}>
      <span className="pill-dot" aria-hidden="true" />
      {LABEL[status] ?? status}
    </span>
  )
}
