import type { StockStatus } from '@/types'

const stockStatusLabel: Record<StockStatus, string> = {
  healthy: 'Healthy',
  low: 'Low stock',
  out: 'Out of stock',
}

export function StockStatusPill({ status }: { status: StockStatus }) {
  return (
    <span className={`pill pill-${status}`}>
      <span className="pill-dot" aria-hidden="true" />
      {stockStatusLabel[status]}
    </span>
  )
}

export function ActiveStatusPill({ isActive }: { isActive: boolean }) {
  return (
    <span className={`pill ${isActive ? 'pill-healthy' : 'pill-neutral'}`}>
      <span className="pill-dot" aria-hidden="true" />
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )
}
