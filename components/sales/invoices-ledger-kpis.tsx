'use client'

import { Ban, CircleDollarSign, Clock, ReceiptText } from 'lucide-react'
import { StaggerList } from '@/components/motion/stagger'
import { StatCard } from '@/components/dashboard/stat-cards'
import type { LedgerKpis } from '@/lib/invoices-ledger'
import { useExchangeRate } from '@/hooks/use-settings'
import { formatLbp, formatNumber, formatPrice } from '@/lib/format'
import { usdToLbp } from '@/services/settings.service'

function kpiDetail(base: string, usd: number, rate: number | null): string {
  const lbp = usdToLbp(usd, rate)
  return lbp === null ? base : `${base} · ≈ ${formatLbp(lbp)}`
}

export function InvoicesLedgerKpis({ kpis, days }: { kpis: LedgerKpis; days: number }) {
  const windowLabel = `Last ${days} days`
  const paidRate = kpis.count > 0 ? (kpis.paidCount / Math.max(kpis.count - kpis.voidCount, 1)) * 100 : 0
  const rate = useExchangeRate().rate

  return (
    <StaggerList className="stats-grid invoices-ledger-kpis">
      <StatCard
        simple
        label="Total invoiced"
        value={formatPrice(kpis.total)}
        detail={kpiDetail(windowLabel, kpis.total, rate)}
        icon={ReceiptText}
        highlight
      />
      <StatCard
        simple
        label="Paid and settled"
        value={formatPrice(kpis.paid)}
        detail={kpiDetail(
          `${formatNumber(kpis.paidCount)} settled · ${paidRate.toFixed(1)}% of ledger`,
          kpis.paid,
          rate,
        )}
        icon={CircleDollarSign}
      />
      <StatCard
        simple
        label="Pending clearance"
        value={formatPrice(kpis.pending)}
        detail={kpiDetail(
          kpis.pendingCount + kpis.draftCount > 0
            ? `${formatNumber(kpis.pendingCount + kpis.draftCount)} open`
            : 'Nothing waiting',
          kpis.pending,
          rate,
        )}
        icon={Clock}
      />
      <StatCard
        simple
        label="Void and credit"
        value={formatPrice(kpis.voided)}
        detail={kpiDetail(
          kpis.voidCount > 0 ? `${formatNumber(kpis.voidCount)} voided` : 'No voids',
          kpis.voided,
          rate,
        )}
        icon={Ban}
      />
    </StaggerList>
  )
}
