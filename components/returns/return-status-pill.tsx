import type { ApiReturnStatus } from '@/lib/api/types'

/**
 * Where a return has got to, in the house pill vocabulary.
 *
 * `in_custody` is deliberately the **warning** tone and not a neutral one: goods
 * are sitting at the counter that still belong to the customer and that nobody
 * has decided about. A manager scanning the list should see those first.
 *
 * An approved return is *not* finished — the money may be unpaid and the goods
 * may be on hold — so it reads as healthy rather than complete. Only
 * `handed_back` is an end state, and it is the end of a *rejected* return.
 */
const TONE: Record<ApiReturnStatus, { className: string; label: string }> = {
  in_custody: { className: 'pill pill-low', label: 'In custody' },
  approved: { className: 'pill pill-healthy', label: 'Approved' },
  rejected: { className: 'pill pill-out', label: 'Rejected' },
  handed_back: { className: 'pill pill-neutral', label: 'Handed back' },
}

export function ReturnStatusPill({ status }: { status: ApiReturnStatus }) {
  const tone = TONE[status]
  return (
    <span className={tone.className}>
      <span className="pill-dot" aria-hidden="true" />
      {tone.label}
    </span>
  )
}
