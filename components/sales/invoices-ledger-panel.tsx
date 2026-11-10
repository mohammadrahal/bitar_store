'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Download, Printer } from 'lucide-react'
import { MotionTbody, MotionTr } from '@/components/motion/motion-table'
import { InvoiceInspector } from '@/components/sales/invoice-inspector'
import { InvoiceLedgerStatusPill } from '@/components/shared/status-pill'
import { Can } from '@/components/shared/can'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Field } from '@/components/shared/field'
import { LocationSelect } from '@/components/shared/location-select'
import { Pagination } from '@/components/shared/pagination'
import { PriceWithLbp } from '@/components/shared/price-with-lbp'
import { SearchInput } from '@/components/shared/search-input'
import { Skeleton } from '@/components/shared/skeleton'
import type { ChipOption } from '@/components/shared/filter-chips'
import { FilterChips } from '@/components/shared/filter-chips'
import { API_INVOICES_LEDGER_LIMIT, useApiInvoices } from '@/hooks/use-api-invoices'
import { useBranches } from '@/hooks/use-branches'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { getApiClient } from '@/lib/api'
import {
  computeApiLedgerKpis,
  ledgerDisplayStatus,
  ledgerRangeIso,
  ledgerStatusLabel,
  matchesInvoiceSearch,
  matchesLedgerTab,
  type LedgerTab,
} from '@/lib/invoices-ledger'
import { formatRelativeDateTime } from '@/lib/format'
import { invoiceLabel, invoiceTotal } from '@/services/invoices-api.service'
import type { ApiInvoiceSummary } from '@/lib/api/types'

const PAGE_SIZE = 12

export type LedgerSelection = { id: string }

type LedgerRow = { id: string; at: string; invoice: ApiInvoiceSummary }

function tabOptions(counts: Record<LedgerTab, number>): ChipOption<LedgerTab>[] {
  return [
    { value: 'all', label: 'All invoices', count: counts.all },
    { value: 'paid', label: 'Paid', count: counts.paid },
    { value: 'pending', label: 'Pending clearance', count: counts.pending },
    { value: 'drafts', label: 'Drafts', count: counts.drafts },
    { value: 'void', label: 'Voided', count: counts.void },
  ]
}

function exportCsv(rows: LedgerRow[], branchName: (id: string) => string) {
  const header = ['Reference', 'Customer', 'Branch', 'When', 'Total USD', 'Status', 'Kind']
  const lines = rows.map((row) => {
    const inv = row.invoice
    const status = ledgerDisplayStatus(inv)
    return [
      invoiceLabel(inv),
      inv.recipient.name ?? '',
      inv.recipient.branchId ? branchName(inv.recipient.branchId) : '',
      inv.finalizedAt ?? inv.createdAt,
      String(invoiceTotal(inv)),
      ledgerStatusLabel(status),
      inv.kind,
    ]
  })
  const body = [header, ...lines].map((cells) => cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
  const blob = new Blob([body.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function InvoicesLedgerPanel({
  branchId,
  allowAllBranches,
  onBranchChange,
  days,
  onCreate,
}: {
  branchId: string
  allowAllBranches: boolean
  onBranchChange: (branchId: string) => void
  days: number
  onCreate: () => void
}) {
  const { data: branches } = useBranches()
  const range = ledgerRangeIso(days)
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput, 250)
  const [tab, setTab] = useState<LedgerTab>('all')
  const [page, setPage] = useState(1)
  const [selection, setSelection] = useState<LedgerSelection | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const listQuery = useApiInvoices({
    branchId,
    from: range.from,
    to: range.to,
    limit: API_INVOICES_LEDGER_LIMIT,
    search: search.trim() || undefined,
  })

  const branchName = (id: string) => branches?.find((b) => b.id === id)?.name ?? ''

  const rows = useMemo(() => {
    const apiItems = listQuery.data?.items ?? []
    const term = search.trim().toLowerCase()
    return apiItems
      .filter((inv) => !term || matchesInvoiceSearch(inv, term))
      .map((invoice) => ({
        id: invoice.id,
        at: invoice.finalizedAt ?? invoice.createdAt,
        invoice,
      }))
      .filter((row) => matchesLedgerTab(ledgerDisplayStatus(row.invoice), tab))
      .sort((a, b) => b.at.localeCompare(a.at))
  }, [listQuery.data?.items, search, tab])

  const tabCounts = useMemo(() => {
    const counts: Record<LedgerTab, number> = { all: 0, paid: 0, pending: 0, drafts: 0, void: 0 }
    for (const inv of listQuery.data?.items ?? []) {
      const status = ledgerDisplayStatus(inv)
      counts.all++
      if (status === 'paid') counts.paid++
      if (status === 'pending') counts.pending++
      if (status === 'draft') counts.drafts++
      if (status === 'void') counts.void++
    }
    return counts
  }, [listQuery.data?.items])

  useEffect(() => {
    setPage(1)
    setChecked(new Set())
  }, [search, tab, branchId, days])

  const total = rows.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const toggleRow = (id: string) => {
    setChecked((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllVisible = () => {
    const ids = visible.map((row) => row.id)
    const every = ids.every((id) => checked.has(id))
    setChecked((previous) => {
      const next = new Set(previous)
      for (const id of ids) {
        if (every) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }

  const bulkPrint = async () => {
    for (const id of checked) {
      try {
        const blob = await getApiClient().downloadInvoicePdf(id)
        const url = URL.createObjectURL(blob)
        window.open(url, '_blank', 'noopener,noreferrer')
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      } catch {
        /* continue */
      }
    }
  }

  if (listQuery.isPending) return <Skeleton rows={1} stats={4} />

  if (listQuery.isError) {
    return (
      <ErrorState
        title="Could not load invoices"
        error={listQuery.error}
        onRetry={() => void listQuery.refetch()}
      />
    )
  }

  return (
    <div className={`invoices-ledger-split ${selection ? 'has-inspector' : ''}`}>
      <div className="invoices-ledger-main">
        <div className="invoices-ledger-toolbar">
          <FilterChips label="Invoice status" options={tabOptions(tabCounts)} value={tab} onChange={setTab} />
          <div className="invoices-ledger-toolbar-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={checked.size === 0}
              onClick={() => void bulkPrint()}
            >
              <Printer size={14} aria-hidden="true" />
              Bulk print
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => exportCsv(rows, branchName)}>
              <Download size={14} aria-hidden="true" />
              Export CSV
            </button>
          </div>
          <div className="invoices-ledger-toolbar-row">
            {allowAllBranches ? (
              <Field label="Location" className="toolbar-field">
                <LocationSelect value={branchId} onChange={onBranchChange} onlyAccessible allowAll />
              </Field>
            ) : null}
            <SearchInput
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Search by invoice #, client, phone…"
              aria-label="Search invoices"
            />
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No invoices in this view"
            description="Invoices come from the API after a till sale (B2C) or a supply transfer (B2B). Try another tab or create one from New sale or Transfers."
            action={
              <Can permission="sales.create">
                <button type="button" className="btn btn-primary" onClick={onCreate}>
                  How to create an invoice
                </button>
              </Can>
            }
          />
        ) : (
          <>
            <div className="table-wrap invoices-ledger-table-wrap">
              <table className="card-table invoices-ledger-table">
                <caption className="sr-only">Invoices ledger</caption>
                <thead>
                  <tr>
                    <th scope="col" className="ledger-col-check">
                      <input
                        type="checkbox"
                        aria-label="Select all on this page"
                        checked={visible.length > 0 && visible.every((row) => checked.has(row.id))}
                        onChange={toggleAllVisible}
                      />
                    </th>
                    <th scope="col">Invoice and time</th>
                    <th scope="col">Customer</th>
                    <th scope="col">Location</th>
                    <th scope="col" className="num">
                      Amount
                    </th>
                    <th scope="col">Status</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <MotionTbody dataset={`${branchId}-${tab}-${currentPage}`}>
                  {visible.map((row, index) => {
                    const selected = selection?.id === row.id
                    const inv = row.invoice
                    const status = ledgerDisplayStatus(inv)
                    const totalUsd = invoiceTotal(inv)
                    const customer = inv.recipient.name ?? (inv.kind === 'b2c' ? 'Walk-in' : '—')
                    const branch =
                      inv.recipient.branchId ? branchName(inv.recipient.branchId) : inv.kind === 'b2b' ? 'Supply' : ''
                    return (
                      <MotionTr
                        key={row.id}
                        index={index}
                        className={selected ? 'ledger-row--selected' : undefined}
                      >
                        <td className="ledger-col-check">
                          <input
                            type="checkbox"
                            aria-label={`Select ${invoiceLabel(inv)}`}
                            checked={checked.has(row.id)}
                            onChange={() => toggleRow(row.id)}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`ledger-invoice-cell ${selected ? 'is-selected' : ''}`}
                            onClick={() => setSelection({ id: row.id })}
                          >
                            <span className="ledger-invoice-ref">{invoiceLabel(inv)}</span>
                            <small className="muted">{formatRelativeDateTime(inv.finalizedAt ?? inv.createdAt)}</small>
                          </button>
                        </td>
                        <td>
                          <span className="ledger-customer">{customer}</span>
                          {inv.recipient.phone ? <small className="muted">{inv.recipient.phone}</small> : null}
                        </td>
                        <td>
                          {branch || '—'}
                          {inv.sale ? <small className="muted">POS</small> : null}
                        </td>
                        <td className="num">
                          <PriceWithLbp
                            usd={totalUsd}
                            exchangeRateUsdLbp={inv.exchangeRate}
                            lbpAmount={inv.totalLbp}
                            strong
                          />
                        </td>
                        <td>
                          <InvoiceLedgerStatusPill status={status} label={ledgerStatusLabel(status)} />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="icon-btn"
                            title="Print"
                            onClick={() => {
                              void (async () => {
                                const blob = await getApiClient().downloadInvoicePdf(inv.id)
                                const url = URL.createObjectURL(blob)
                                window.open(url, '_blank', 'noopener,noreferrer')
                                window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
                              })()
                            }}
                          >
                            <Printer size={16} aria-hidden="true" />
                            <span className="sr-only">Print</span>
                          </button>
                        </td>
                      </MotionTr>
                    )
                  })}
                </MotionTbody>
              </table>
            </div>
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              total={total}
              pageSize={PAGE_SIZE}
              onPage={setPage}
            />
          </>
        )}
      </div>

      {selection ? <InvoiceInspector invoiceId={selection.id} onClose={() => setSelection(null)} /> : null}
    </div>
  )
}

export function useInvoicesLedgerKpis(branchId: string, days: number) {
  const range = ledgerRangeIso(days)
  const listQuery = useApiInvoices({
    branchId,
    from: range.from,
    to: range.to,
    limit: API_INVOICES_LEDGER_LIMIT,
  })

  return useMemo(() => computeApiLedgerKpis(listQuery.data?.items ?? []), [listQuery.data?.items])
}
