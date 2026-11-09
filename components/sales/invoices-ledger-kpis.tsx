'use client'

import { Ban, CircleDollarSign, Clock, ReceiptText } from 'lucide-react'
import { StaggerList } from '@/components/motion/stagger'
import { StatCard } from '@/components/dashboard/stat-cards'
import type { LedgerKpis } from '@/lib/invoices-ledger'
import { formatNumber, formatPrice } from '@/lib/format'

export function InvoicesLedgerKpis({ kpis, days }: { kpis: LedgerKpis; days: number }) {
  const windowLabel = `Last ${days} days`
  const paidRate = kpis.count > 0 ? (kpis.paidCount / Math.max(kpis.count - kpis.voidCount, 1)) * 100 : 0

  return (
    <StaggerList className="stats-grid invoices-ledger-kpis">
      <StatCard
        simple
        label="Total invoiced"
        value={formatPrice(kpis.total)}
        detail={windowLabel}
        icon={ReceiptText}
        highlight
      />
      <StatCard
        simple
        label="Paid and settled"
        value={formatPrice(kpis.paid)}
        detail={`${formatNumber(kpis.paidCount)} settled · ${paidRate.toFixed(1)}% of ledger`}
        icon={CircleDollarSign}
      />
      <StatCard
        simple
        label="Pending clearance"
        value={formatPrice(kpis.pending)}
        detail={
          kpis.pendingCount + kpis.draftCount > 0
            ? `${formatNumber(kpis.pendingCount + kpis.draftCount)} open`
            : 'Nothing waiting'
        }
        icon={Clock}
      />
      <StatCard
        simple
        label="Void and credit"
        value={formatPrice(kpis.voided)}
        detail={kpis.voidCount > 0 ? `${formatNumber(kpis.voidCount)} voided` : 'No voids'}
        icon={Ban}
      />
    </StaggerList>
  )
}
