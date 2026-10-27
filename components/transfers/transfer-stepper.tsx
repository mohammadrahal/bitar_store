import type { TransferRow } from '@/types'

const STEPS = ['Requested', 'Approved', 'Dispatched', 'Received', 'Closed'] as const

function reachedStep(transfer: TransferRow) {
  switch (transfer.status) {
    case 'requested':
      return 0
    case 'approved':
      return 1
    case 'dispatched':
      return 2
    case 'partly_received':
      return 3
    case 'closed':
      return 4
    case 'cancelled':
      return -1
  }
}

function detailFor(step: number, transfer: TransferRow) {
  const { totals } = transfer
  if (step === 1 && totals.approved) return `${totals.approved} reserved`
  if (step === 2 && totals.dispatched) return `${totals.dispatched} of ${totals.approved} sent`
  if (step === 3 && (totals.received || totals.damaged)) return `${totals.received} accepted${totals.damaged ? `, ${totals.damaged} on hold` : ''}`
  if (step === 0) return `${totals.requested} requested`
  return ''
}

export function TransferStepper({ transfer }: { transfer: TransferRow }) {
  const reached = reachedStep(transfer)
  return (
    <ol className="stepper-track" aria-label="Transfer progress">
      {STEPS.map((label, index) => {
        const state = index < reached || (index === reached && reached === 4) ? 'done' : index === reached ? 'current' : ''
        return (
          <li key={label} className={`step ${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="step-dot" aria-hidden="true" />
            <strong>{label}</strong>
            <small className="tabular">{index <= reached ? detailFor(index, transfer) : ''}</small>
          </li>
        )
      })}
    </ol>
  )
}
