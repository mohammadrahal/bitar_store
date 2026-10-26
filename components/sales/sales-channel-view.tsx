'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { InvoiceForm } from '@/components/invoices/invoice-form'
import { InvoiceTable } from '@/components/invoices/invoice-table'
import { Can } from '@/components/shared/can'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Pagination } from '@/components/shared/pagination'
import { Panel } from '@/components/shared/panel'
import { SelectInput } from '@/components/shared/select-input'
import { Skeleton } from '@/components/shared/skeleton'
import { useBranchScope, useDefaultBranchId } from '@/hooks/use-branch-scope'
import { useInvoices } from '@/hooks/use-invoices'
import { INVOICE_STATUS_LABELS } from '@/lib/invoices'
import { ALL_BRANCHES, type InvoiceStatus, type SalesChannel } from '@/types'

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250
const STATUSES: InvoiceStatus[] = ['draft', 'issued', 'paid', 'void']

const CREATE_ACTION = {
  b2b: 'sales:b2b:create',
  b2c: 'sales:b2c:create',
} as const satisfies Record<SalesChannel, 'sales:b2b:create' | 'sales:b2c:create'>

const COPY: Record<
  SalesChannel,
  {
    title: string
    description: string
    panelTitle: string
    emptyTitle: string
    emptyDescription: string
    newLabel: string
  }
> = {
  b2b: {
    title: 'B2B sales',
    description: 'Wholesale and account orders sold to other businesses.',
    panelTitle: 'Wholesale ledger',
    emptyTitle: 'No wholesale sales yet',
    emptyDescription: 'Record a B2B sale to track stock and revenue for trade customers.',
    newLabel: 'New B2B sale',
  },
  b2c: {
    title: 'B2C sales',
    description: 'In-store and direct consumer sales from the till.',
    panelTitle: 'Retail sales',
    emptyTitle: 'No retail sales yet',
    emptyDescription: 'Ring up a walk-in or till sale to remove units from branch stock.',
    newLabel: 'New B2C sale',
  },
}

export function SalesChannelView({ channel }: { channel: SalesChannel }) {
  const copy = COPY[channel]
  const scope = useBranchScope()
  const defaultBranchId = useDefaultBranchId()

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<InvoiceStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (searchInput === search) return
    const timer = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput, search])

  useEffect(() => {
    setPage(1)
  }, [search, status, scope, channel])

  const filters = useMemo(
    () => ({ scope, kind: 'all' as const, status, search, salesChannel: channel }),
    [scope, status, search, channel],
  )
  const { data: invoices, isPending, isError, error, refetch } = useInvoices(filters)

  const total = invoices?.length ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = invoices?.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE) ?? []
  const isFiltered = search.trim() !== '' || status !== 'all'

  return (
    <>
      <PageHeader
        eyebrow="Sales"
        title={copy.title}
        description={copy.description}
        actions={
          <Can action={CREATE_ACTION[channel]}>
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              <Plus size={16} aria-hidden="true" />
              {copy.newLabel}
            </button>
          </Can>
        }
      />

      <Panel
        title={copy.panelTitle}
        description={isPending ? 'Loading…' : `${total} ${total === 1 ? 'document' : 'documents'}`}
      >
        <div className="toolbar">
          <div className="search-field">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search number, customer or SKU"
              aria-label="Search sales"
            />
          </div>
          <SelectInput
            variant="inline"
            aria-label="Filter by status"
            value={status}
            onValueChange={(next) => setStatus(next as InvoiceStatus | 'all')}
            options={[
              { value: 'all', label: 'Any status' },
              ...STATUSES.map((option) => ({
                value: option,
                label: INVOICE_STATUS_LABELS[option],
              })),
            ]}
          />
          {isFiltered && (
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                setSearchInput('')
                setSearch('')
                setStatus('all')
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        {isPending ? (
          <div className="panel-body">
            <Skeleton rows={1} stats={0} />
          </div>
        ) : isError ? (
          <div className="panel-body">
            <ErrorState title="Could not load sales" error={error} onRetry={() => void refetch()} />
          </div>
        ) : (
          <>
            <InvoiceTable
              invoices={visible}
              filtered={isFiltered}
              showBranch={scope === ALL_BRANCHES}
              onCreate={() => setCreating(true)}
              createAction={CREATE_ACTION[channel]}
              emptyTitle={copy.emptyTitle}
              emptyDescription={copy.emptyDescription}
              emptyActionLabel={copy.newLabel}
            />
            <Pagination page={currentPage} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
          </>
        )}
      </Panel>

      {creating && defaultBranchId && (
        <InvoiceForm
          defaultBranchId={defaultBranchId}
          salesChannel={channel}
          saleOnly
          onClose={() => setCreating(false)}
        />
      )}
    </>
  )
}
