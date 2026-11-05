'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { WholesaleInvoicesPanel } from '@/components/sales/wholesale-invoices-panel'
import { Can } from '@/components/shared/can'
import { FilterChips, type ChipOption } from '@/components/shared/filter-chips'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { useAllowPageBranchFilter, useEffectiveListBranchId } from '@/hooks/use-branch-scope'
import { useWholesaleInvoices } from '@/hooks/use-wholesale-invoices'
import type { WholesaleInvoiceStatus } from '@/services/wholesale-invoices.service'

type InvoiceTab = 'drafts' | 'issued'

const TAB_OPTIONS: ChipOption<InvoiceTab>[] = [
  { value: 'drafts', label: 'Drafts' },
  { value: 'issued', label: 'Issued' },
]

export function InvoicesView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const allowPageBranchFilter = useAllowPageBranchFilter()

  const tabParam = searchParams.get('tab')
  const [tab, setTab] = useState<InvoiceTab>(tabParam === 'drafts' ? 'drafts' : 'issued')
  const [pageBranchId, setPageBranchId] = useState('')
  const branchId = useEffectiveListBranchId(pageBranchId)

  useEffect(() => {
    if (tabParam === 'drafts') setTab('drafts')
  }, [tabParam])

  const status: WholesaleInvoiceStatus = tab === 'drafts' ? 'draft' : 'issued'
  const listQuery = useWholesaleInvoices(branchId, status)
  const draftCountQuery = useWholesaleInvoices(branchId, 'draft')
  const draftCount = draftCountQuery.data?.length ?? 0

  const startInvoice = () => router.push('/sales/invoices/new')

  return (
    <>
      <PageHeader
        eyebrow="Wholesale"
        title="Invoices"
        description="B2B documents for business customers. Separate from till sales — nothing here posts with `POST /sales`."
        actions={
          <Can permission="sales.create">
            <button type="button" className="btn btn-primary" onClick={startInvoice}>
              <Plus size={16} aria-hidden="true" />
              New invoice
            </button>
          </Can>
        }
      />

      <Panel
        title={tab === 'drafts' ? 'Draft invoices' : 'Issued invoices'}
        description={
          listQuery.isPending
            ? 'Loading…'
            : tab === 'drafts'
              ? `${listQuery.data?.length ?? 0} ${(listQuery.data?.length ?? 0) === 1 ? 'draft' : 'drafts'} on this device`
              : `${listQuery.data?.length ?? 0} issued on this device`
        }
        actions={
          <FilterChips
            label="Show"
            options={TAB_OPTIONS.map((option) =>
              option.value === 'drafts' && draftCount > 0 ? { ...option, label: `Drafts (${draftCount})` } : option,
            )}
            value={tab}
            onChange={(value) => {
              setTab(value)
              router.replace(value === 'drafts' ? '/sales/invoices?tab=drafts' : '/sales/invoices', { scroll: false })
            }}
          />
        }
      >
        <WholesaleInvoicesPanel
          branchId={branchId}
          status={status}
          onCreate={startInvoice}
          allowAllBranches={allowPageBranchFilter}
          onBranchChange={setPageBranchId}
        />
      </Panel>
    </>
  )
}
