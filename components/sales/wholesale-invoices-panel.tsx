'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ReceiptText } from 'lucide-react'
import { MotionTbody, MotionTr } from '@/components/motion/motion-table'
import { receiptPaymentsFromDraft } from '@/components/sales/sale-receipt-build'
import { printWholesaleInvoice } from '@/components/sales/sale-receipt-print'
import { Can } from '@/components/shared/can'
import { EmptyState } from '@/components/shared/empty-state'
import { Field } from '@/components/shared/field'
import { LocationSelect } from '@/components/shared/location-select'
import { Pagination } from '@/components/shared/pagination'
import { SearchInput } from '@/components/shared/search-input'
import { Skeleton } from '@/components/shared/skeleton'
import { useBranches } from '@/hooks/use-branches'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useDeleteWholesaleInvoice, useWholesaleInvoices } from '@/hooks/use-wholesale-invoices'
import { useCurrentUser } from '@/store/user-store'
import { formatDocumentDate, formatPrice } from '@/lib/format'
import { paymentMethodLabel } from '@/lib/sale-payments'
import {
  wholesaleInvoiceTotal,
  wholesaleReference,
  type WholesaleInvoice,
  type WholesaleInvoiceStatus,
} from '@/services/wholesale-invoices.service'

const PAGE_SIZE = 10

function lineUnits(invoice: WholesaleInvoice) {
  return invoice.lines.reduce((sum, line) => sum + line.quantity, 0)
}

function matchesSearch(invoice: WholesaleInvoice, query: string) {
  const haystack = [invoice.customerName, invoice.note, wholesaleReference(invoice), ...invoice.lines.map((l) => l.label)]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

export function WholesaleInvoicesPanel({
  branchId,
  status,
  onCreate,
  allowAllBranches = false,
  onBranchChange,
}: {
  branchId: string
  status: WholesaleInvoiceStatus
  onCreate?: () => void
  allowAllBranches?: boolean
  onBranchChange?: (branchId: string) => void
}) {
  const user = useCurrentUser()
  const { data: branches } = useBranches()
  const query = useWholesaleInvoices(branchId, status)
  const remove = useDeleteWholesaleInvoice()
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput, 250)
  const [page, setPage] = useState(1)
  const showBranchColumn = allowAllBranches && !branchId

  const rows = useMemo(() => {
    const all = query.data ?? []
    const term = search.trim().toLowerCase()
    return term ? all.filter((row) => matchesSearch(row, term)) : all
  }, [query.data, search])

  const total = rows.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const print = (invoice: WholesaleInvoice) => {
    const branchName = branches?.find((b) => b.id === invoice.branchId)?.name
    printWholesaleInvoice({
      reference: wholesaleReference(invoice),
      status: invoice.status,
      customerName: invoice.customerName,
      issuedAt: invoice.issuedAt ?? invoice.createdAt,
      sellerName: user.name,
      branchName,
      note: invoice.note,
      total: wholesaleInvoiceTotal(invoice),
      payments: invoice.payment
        ? receiptPaymentsFromDraft(invoice.payment, wholesaleInvoiceTotal(invoice))
        : undefined,
      lines: invoice.lines.map((line) => ({
        label: line.label,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.quantity * line.unitPrice,
      })),
    })
  }

  if (query.isPending) return <Skeleton rows={1} stats={0} />

  return (
    <>
      <div className="toolbar">
        {allowAllBranches && onBranchChange && (
          <Field label="Branch" className="toolbar-field">
            <LocationSelect value={branchId} onChange={onBranchChange} onlyAccessible allowAll />
          </Field>
        )}
        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Customer, reference or SKU"
          aria-label="Search wholesale invoices"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title={status === 'draft' ? 'No draft invoices' : 'No issued invoices yet'}
          description={
            status === 'draft'
              ? 'Start a wholesale invoice for a business customer. It will not post as a till sale.'
              : 'Issue a draft when the customer confirms the order.'
          }
          action={
            onCreate ? (
              <Can permission="sales.create">
                <button type="button" className="btn btn-primary" onClick={onCreate}>
                  New invoice
                </button>
              </Can>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="table-wrap">
            <table className="card-table">
              <caption className="sr-only">Wholesale invoices</caption>
              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">Customer</th>
                  {showBranchColumn ? <th scope="col">Branch</th> : null}
                  <th scope="col">When</th>
                  <th scope="col" className="num">
                    Units
                  </th>
                  <th scope="col" className="num">
                    Total
                  </th>
                  {status === 'issued' ? <th scope="col">Payment</th> : null}
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <MotionTbody dataset={`${branchId}-${status}-${currentPage}`}>
                {visible.map((invoice, index) => (
                  <MotionTr key={invoice.id} index={index}>
                    <td className="card-title">
                      <Link href={`/sales/invoices/${invoice.id}`}>{wholesaleReference(invoice)}</Link>
                    </td>
                    <td>{invoice.customerName}</td>
                    {showBranchColumn ? (
                      <td>{branches?.find((b) => b.id === invoice.branchId)?.name ?? '—'}</td>
                    ) : null}
                    <td>{formatDocumentDate(invoice.issuedAt ?? invoice.createdAt)}</td>
                    <td className="num tabular">{lineUnits(invoice)}</td>
                    <td className="num tabular">{formatPrice(wholesaleInvoiceTotal(invoice))}</td>
                    {status === 'issued' ? (
                      <td>{paymentMethodLabel(invoice.payment, wholesaleInvoiceTotal(invoice))}</td>
                    ) : null}
                    <td>
                      <div className="row-actions">
                        {invoice.status === 'draft' && (
                          <Link href={`/sales/invoices/new?draft=${invoice.id}`} className="btn btn-ghost btn-sm">
                            Edit
                          </Link>
                        )}
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => print(invoice)}>
                          Print
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm danger" onClick={() => remove.mutate({ id: invoice.id })}>
                          Remove
                        </button>
                      </div>
                    </td>
                  </MotionTr>
                ))}
              </MotionTbody>
            </table>
          </div>
          <Pagination page={currentPage} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
        </>
      )}
    </>
  )
}
