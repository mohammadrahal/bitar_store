import { ArrowDownLeft, ArrowUpRight, Repeat } from 'lucide-react'
import { INVOICE_KIND_LABELS, INVOICE_STATUS_LABELS, stockSign } from '@/lib/invoices'
import type { InvoiceKind, InvoiceStatus } from '@/types'

const STATUS_TONES: Record<InvoiceStatus, string> = {
  draft: 'pill-neutral',
  issued: 'pill-accent',
  paid: 'pill-healthy',
  void: 'pill-out',
}

export function InvoiceStatusPill({ status }: { status: InvoiceStatus }) {
  return (
    <span className={`pill ${STATUS_TONES[status]}`}>
      <span className="pill-dot" aria-hidden="true" />
      {INVOICE_STATUS_LABELS[status]}
    </span>
  )
}

/** The arrow is the direction stock moves, which is the thing worth scanning for. */
export function InvoiceKindBadge({ kind, isInternal = false }: { kind: InvoiceKind; isInternal?: boolean }) {
  const label = isInternal ? 'Transfer' : INVOICE_KIND_LABELS[kind]
  const Icon = isInternal ? Repeat : stockSign(kind) === 1 ? ArrowDownLeft : ArrowUpRight

  return (
    <span className="kind-badge">
      <Icon size={14} aria-hidden="true" />
      {label}
    </span>
  )
}
