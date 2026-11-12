'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Plus } from 'lucide-react'
import { InvoicesLedgerPanel, useInvoicesLedgerKpis } from '@/components/sales/invoices-ledger-panel'
import { InvoicesLedgerKpis } from '@/components/sales/invoices-ledger-kpis'
import { Can } from '@/components/shared/can'
import { LocationEyebrow } from '@/components/shared/page-header'
import { useAllowPageBranchFilter, useEffectiveListBranchId } from '@/hooks/use-branch-scope'
import { useBranches } from '@/hooks/use-branches'
import { usePermission } from '@/hooks/use-permission'
import { homePathFor } from '@/lib/permissions'
import { useCurrentUser } from '@/store/user-store'
import { clearLegacyWholesaleInvoices } from '@/lib/clear-legacy-wholesale-invoices'
import { formatNumber } from '@/lib/format'
import type { LedgerKind } from '@/lib/invoices-ledger'

const LEDGER_DAYS = 30
export function InvoicesView() {
  const router = useRouter()
  const allowPageBranchFilter = useAllowPageBranchFilter()
  const [pageBranchId, setPageBranchId] = useState('')
  const branchId = useEffectiveListBranchId(pageBranchId)
  const { data: branches } = useBranches()
  const user = useCurrentUser()
  const { activeLocationId, canViewInvoicesLedger } = usePermission()

  useEffect(() => {
    clearLegacyWholesaleInvoices()
  }, [])

  useEffect(() => {
    if (!canViewInvoicesLedger()) router.replace(homePathFor(user))
  }, [canViewInvoicesLedger, router, user])

  const branchLabel = useMemo(() => {
    if (branchId) return branches?.find((b) => b.id === branchId)?.name
    return activeLocationId ? branches?.find((b) => b.id === activeLocationId)?.name : undefined
  }, [branchId, branches, activeLocationId])

  const [kind, setKind] = useState<LedgerKind>('all')
  const kpis = useInvoicesLedgerKpis(branchId, LEDGER_DAYS, kind)
  const startInvoice = () => router.push('/sales/invoices/new')

  return (
    <div className="invoices-ledger-page">
      <header className="invoices-ledger-header page-heading">
        <div>
          {branchLabel ? (
            <LocationEyebrow label="Fiscal registry" name={branchLabel} />
          ) : (
            <p className="eyebrow">Fiscal registry</p>
          )}
          <h1 className="invoices-ledger-page-title">
            Invoices ledger
            <span className="invoices-ledger-record-count tabular">{formatNumber(kpis.count)} records</span>
          </h1>
          <p className="subtitle">
            All rows load from the API: retail invoices after till sales, and supply or return invoices once a transfer is sent.
          </p>
        </div>
        <div className="invoices-ledger-header-actions heading-actions">
          <button type="button" className="btn btn-secondary">
            <CalendarDays size={16} aria-hidden="true" />
            Last {LEDGER_DAYS} days
          </button>
          <Can permission="sales.create">
            <button type="button" className="btn btn-primary" onClick={startInvoice}>
              <Plus size={16} aria-hidden="true" />
              Create invoice
            </button>
          </Can>
        </div>
      </header>

      <InvoicesLedgerKpis kpis={kpis} days={LEDGER_DAYS} />

      <InvoicesLedgerPanel
        branchId={branchId}
        allowAllBranches={allowPageBranchFilter}
        onBranchChange={setPageBranchId}
        days={LEDGER_DAYS}
        kind={kind}
        onKindChange={setKind}
        onCreate={startInvoice}
      />
    </div>
  )
}
