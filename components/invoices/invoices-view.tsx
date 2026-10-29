'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { SearchInput } from '@/components/shared/search-input'
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
import { INVOICE_KIND_LABELS, INVOICE_KINDS, INVOICE_STATUS_LABELS } from '@/lib/invoices'
import { useUIStore } from '@/store/ui-store'
import { ALL_BRANCHES, type InvoiceStatus } from '@/types'

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250
const STATUSES: InvoiceStatus[] = ['draft', 'issued', 'paid', 'void']

export function InvoicesView() {
  const scope = useBranchScope()
  const defaultBranchId = useDefaultBranchId()

  const search = useUIStore((state) => state.invoiceSearch)
  const setSearch = useUIStore((state) => state.setInvoiceSearch)
  const kind = useUIStore((state) => state.invoiceKind)
  const setKind = useUIStore((state) => state.setInvoiceKind)
  const status = useUIStore((state) => state.invoiceStatus)
  const setStatus = useUIStore((state) => state.setInvoiceStatus)

  const [searchInput, setSearchInput] = useState(search)
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)

  // Typing updates the query a beat later, so each keystroke is not its own fetch.
  useEffect(() => {
    if (searchInput === search) return
    const timer = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput, search, setSearch])

  useEffect(() => {
    setPage(1)
  }, [search, kind, status, scope])

  const filters = useMemo(() => ({ scope, kind, status, search }), [scope, kind, status, search])
  const { data: invoices, isPending, isError, error, refetch } = useInvoices(filters)

  const total = invoices?.length ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = invoices?.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE) ?? []
  const isFiltered = search.trim() !== '' || kind !== 'all' || status !== 'all'

  return (
    <>
      <PageHeader
        eyebrow="Ledger"
        title="Invoices"
        description="Sales, supplier purchases and the returns that reverse them. Issuing an invoice moves branch stock."
        actions={
          <Can permission="documents.manage">
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              <Plus size={16} aria-hidden="true" />
              New invoice
            </button>
          </Can>
        }
      />

      <Panel
        title="All invoices"
        description={isPending ? 'Loading…' : `${total} ${total === 1 ? 'invoice' : 'invoices'}`}
      >
        <div className="toolbar">
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search number, party or SKU"
            aria-label="Search invoices"
          />
          <SelectInput
            variant="inline"
            aria-label="Filter by kind"
            value={kind}
            onValueChange={setKind}
            options={[
              { value: 'all', label: 'All kinds' },
              ...INVOICE_KINDS.map((option) => ({
                value: option,
                label: INVOICE_KIND_LABELS[option],
              })),
            ]}
          />
          <SelectInput
            variant="inline"
            aria-label="Filter by status"
            value={status}
            onValueChange={setStatus}
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
                setKind('all')
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
            <ErrorState title="Could not load invoices" error={error} onRetry={() => void refetch()} />
          </div>
        ) : (
          <>
            <InvoiceTable
              invoices={visible}
              filtered={isFiltered}
              showBranch={scope === ALL_BRANCHES}
              onCreate={() => setCreating(true)}
            />
            <Pagination page={currentPage} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
          </>
        )}
      </Panel>

      {/* No branch, no document: the form would open on an empty Branch select. */}
      {creating && defaultBranchId && (
        <InvoiceForm defaultBranchId={defaultBranchId} onClose={() => setCreating(false)} />
      )}
    </>
  )
}
