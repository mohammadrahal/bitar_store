import type { StockStatus } from '@/types'

const stockStatusLabel: Record<StockStatus, string> = {
  healthy: 'In stock',
  out: 'Out of stock',
}

const stockStatusTone: Record<StockStatus, string> = {
  healthy: 'pill-healthy',
  out: 'pill-out',
}

export function StockStatusPill({ status }: { status: StockStatus }) {
  return (
    <span className={`pill ${stockStatusTone[status]}`}>
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
