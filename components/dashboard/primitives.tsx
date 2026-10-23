import { cloneElement, isValidElement, useId, type ReactElement } from 'react'
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'
import type { StockStatus, TransferStatus } from '@/lib/inventory/types'

const stockStatusLabel: Record<StockStatus, string> = { healthy: 'Healthy', low: 'Low stock', out: 'Out of stock' }

export function StatusPill({ status }: { status: StockStatus }) {
  return (
    <span className={`pill pill-${status}`}>
      <span className="pill-dot" aria-hidden="true" />
      {stockStatusLabel[status]}
    </span>
  )
}

const transferStatusLabel: Record<TransferStatus, string> = { in_transit: 'In transit', received: 'Received', cancelled: 'Cancelled' }
const transferStatusTone: Record<TransferStatus, StockStatus | 'neutral'> = { in_transit: 'low', received: 'healthy', cancelled: 'neutral' }

export function TransferPill({ status }: { status: TransferStatus }) {
  return (
    <span className={`pill pill-${transferStatusTone[status]}`}>
      <span className="pill-dot" aria-hidden="true" />
      {transferStatusLabel[status]}
    </span>
  )
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true">
        <Icon size={20} />
      </span>
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  )
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: React.ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        <p className="subtitle">{description}</p>
      </div>
      {actions && <div className="heading-actions">{actions}</div>}
    </div>
  )
}

export function Panel({ title, description, actions, children, className }: { title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`panel ${className ?? ''}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}

export function Field({
  label,
  error,
  hint,
  className,
  children,
}: {
  label: string
  error?: string
  hint?: string
  className?: string
  children: ReactElement<Record<string, unknown>>
}) {
  const id = useId()
  const messageId = `${id}-message`
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error || hint ? messageId : undefined,
      })
    : children

  return (
    <div className={`field ${className ?? ''}`}>
      <label htmlFor={id}>{label}</label>
      {control}
      {(error || hint) && (
        <span id={messageId} className={error ? 'field-error' : 'field-hint'}>
          {error ?? hint}
        </span>
      )}
    </div>
  )
}

export function Pagination({ page, pageCount, total, pageSize, onPage }: { page: number; pageCount: number; total: number; pageSize: number; onPage: (page: number) => void }) {
  if (total <= pageSize) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="muted tabular">
        {from}–{to} of {total}
      </span>
      <div>
        <button type="button" className="icon-btn" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft size={16} />
        </button>
        <span className="tabular">
          {page} / {pageCount}
        </span>
        <button type="button" className="icon-btn" onClick={() => onPage(page + 1)} disabled={page >= pageCount} aria-label="Next page">
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  )
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skeleton-wrap" aria-busy="true" aria-label="Loading">
      <div className="skeleton skeleton-title" />
      <div className="stats-grid">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton skeleton-card" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton skeleton-row" />
      ))}
    </div>
  )
}
