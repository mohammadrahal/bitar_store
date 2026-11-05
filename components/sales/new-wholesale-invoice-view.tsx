'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { InvoiceLinePicker } from '@/components/sales/invoice-line-picker'
import { PaymentFields } from '@/components/sales/payment-fields'
import { LocationSelect } from '@/components/shared/location-select'
import { useDefaultBranchId } from '@/hooks/use-branch-scope'
import { useBranches } from '@/hooks/use-branches'
import { useSaveWholesaleInvoice } from '@/hooks/use-wholesale-invoices'
import { usePermission } from '@/hooks/use-permission'
import { useCurrentUser } from '@/store/user-store'
import { formatDocumentDate, formatPrice, todayAsDateInput } from '@/lib/format'
import { fromCents, toCents } from '@/lib/money'
import { emptyPayment, paymentProblem, syncTendered, type PaymentDraft } from '@/lib/sale-payments'
import { getWholesaleInvoice } from '@/services/wholesale-invoices.service'
import type { VariantOption } from '@/types'

interface CartLine {
  option: VariantOption
  quantity: number
}

function optionFromLine(line: { skuId: string; label: string; unitPrice: number }): VariantOption {
  const [productName, variantPart] = line.label.split(' · ')
  const [color, size] = (variantPart ?? '').split(' / ')
  return {
    variantId: line.skuId,
    productId: '',
    productName: productName ?? line.label,
    sku: line.skuId,
    barcode: '',
    color: color ?? '',
    size: size ?? '',
    sellPrice: line.unitPrice,
    available: 0,
  }
}

export function NewWholesaleInvoiceView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const user = useCurrentUser()
  const { locationScoped } = usePermission()
  const defaultBranch = useDefaultBranchId()
  const { data: branches } = useBranches()
  const save = useSaveWholesaleInvoice()

  const [branchChoice, setBranch] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<CartLine[]>([])
  const [draftId, setDraftId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [payment, setPayment] = useState<PaymentDraft>(emptyPayment)
  const branchId = locationScoped ? defaultBranch : branchChoice
  const branch = branches?.find((b) => b.id === branchId)
  const invoiceDate = todayAsDateInput()

  useEffect(() => {
    const id = searchParams.get('draft')
    if (!id) return
    const draft = getWholesaleInvoice(id)
    if (!draft || draft.status !== 'draft') return
    if (!locationScoped) setBranch(draft.branchId)
    setDraftId(draft.id)
    setCustomerName(draft.customerName)
    setNote(draft.note)
    setLines(draft.lines.map((line) => ({ option: optionFromLine(line), quantity: line.quantity })))
    setPayment(draft.payment ?? emptyPayment())
  }, [searchParams, locationScoped])

  const subtotal = fromCents(lines.reduce((sum, line) => sum + line.quantity * toCents(line.option.sellPrice), 0))

  useEffect(() => {
    setPayment((current) => syncTendered(current, subtotal))
  }, [subtotal])
  const units = lines.reduce((sum, line) => sum + line.quantity, 0)
  const inCart = Object.fromEntries(lines.map((line) => [line.option.variantId, line.quantity]))
  const referencePreview = draftId ? `DRAFT-${draftId.slice(0, 8).toUpperCase()}` : 'Draft'

  const toPayload = (status: 'draft' | 'issued') => ({
    id: draftId ?? undefined,
    branchId,
    customerName,
    note: note.trim(),
    status,
    lines: lines.map((line) => ({
      skuId: line.option.variantId,
      label: `${line.option.productName} · ${line.option.color} / ${line.option.size}`,
      quantity: line.quantity,
      unitPrice: line.option.sellPrice,
    })),
    payment,
  })

  const persist = (status: 'draft' | 'issued') => {
    if (!branchId || lines.length === 0) return
    if (!customerName.trim()) {
      toast.error('Enter the customer on the invoice')
      return
    }
    if (status === 'issued') {
      const problem = paymentProblem(payment, subtotal)
      if (problem) {
        toast.error(problem)
        return
      }
    }
    save.mutate(toPayload(status), {
      onSuccess: (invoice) => {
        setDraftId(invoice.id)
        if (status === 'draft') {
          toast.success('Draft saved')
          router.push('/sales/invoices?tab=drafts')
          return
        }
        toast.success('Invoice issued')
        router.push(`/sales/invoices/${invoice.id}`)
      },
    })
  }

  const add = (option: VariantOption, quantity: number) => {
    setLines((current) => {
      const existing = current.find((line) => line.option.variantId === option.variantId)
      if (!existing) return [...current, { option, quantity }]
      return current.map((line) => (line === existing ? { ...line, quantity: line.quantity + quantity } : line))
    })
    setPickerOpen(false)
  }

  const setLineQty = (variantId: string, quantity: number) => {
    const qty = Math.max(1, Math.min(9999, quantity))
    setLines((current) => current.map((line) => (line.option.variantId === variantId ? { ...line, quantity: qty } : line)))
  }

  return (
    <div className="invoice-page">
      <div className="invoice-page-toolbar">
        <Link href="/sales/invoices" className="back-link">
          <ArrowLeft size={16} aria-hidden="true" />
          Invoices
        </Link>
        <div className="invoice-page-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!branchId || lines.length === 0 || save.isPending}
            onClick={() => persist('draft')}
          >
            Save draft
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!branchId || lines.length === 0 || save.isPending}
            onClick={() => persist('issued')}
          >
            Issue invoice
          </button>
        </div>
      </div>

      <article className="invoice-sheet" aria-label="Wholesale invoice">
        <header className="invoice-sheet-header">
          <div className="invoice-from">
            <Link href="/dashboard" className="invoice-logo brand-logo" aria-label="Bitar Fashion">
              <span className="logo-full" aria-hidden="true" />
            </Link>
            <p className="invoice-from-name">Bitar Fashion</p>
            {branch ? (
              <>
                <p>{branch.name}</p>
                {branch.code && <p className="invoice-muted">{branch.code}</p>}
              </>
            ) : (
              <p className="invoice-muted">Select a billing branch below</p>
            )}
          </div>
          <div className="invoice-title-block">
            <h1 className="invoice-title">Invoice</h1>
            <dl className="invoice-meta-list">
              <div>
                <dt>Invoice #</dt>
                <dd className="tabular">{referencePreview}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{formatDocumentDate(new Date(invoiceDate).toISOString())}</dd>
              </div>
              <div>
                <dt>Prepared by</dt>
                <dd>{user.name}</dd>
              </div>
            </dl>
          </div>
        </header>

        <div className="invoice-parties">
          <section className="invoice-party invoice-party-bill-to">
            <h2>Bill to</h2>
            <input
              className="invoice-party-input"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Customer or business name"
              autoComplete="organization"
              aria-label="Bill to customer"
            />
          </section>
          {!locationScoped && (
            <section className="invoice-party">
              <h2>Branch</h2>
              <LocationSelect
                value={branchChoice}
                onChange={(value) => {
                  setBranch(value)
                  setLines([])
                }}
                onlyAccessible
                onlyFullAccess
                placeholder="Billing branch"
                aria-label="Billing branch"
              />
            </section>
          )}
        </div>

        <div className="invoice-table-wrap">
          <table className="invoice-table">
            <thead>
              <tr>
                <th scope="col" className="invoice-col-desc">
                  Description
                </th>
                <th scope="col" className="invoice-col-sku">
                  SKU
                </th>
                <th scope="col" className="invoice-col-qty num">
                  Qty
                </th>
                <th scope="col" className="invoice-col-unit num">
                  Unit price
                </th>
                <th scope="col" className="invoice-col-amount num">
                  Amount
                </th>
                <th scope="col" className="invoice-col-action">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr className="invoice-empty-row">
                  <td colSpan={6}>
                    <p>No line items yet. Add products below.</p>
                  </td>
                </tr>
              ) : (
                lines.map((line) => {
                  const amount = line.quantity * line.option.sellPrice
                  return (
                    <tr key={line.option.variantId}>
                      <td>
                        <strong>{line.option.productName}</strong>
                        <span className="invoice-line-variant">
                          {line.option.color} / {line.option.size}
                        </span>
                      </td>
                      <td className="tabular invoice-muted">{line.option.sku}</td>
                      <td className="num">
                        <input
                          type="number"
                          inputMode="numeric"
                          step={1}
                          className="invoice-qty-input tabular"
                          min={1}
                          max={9999}
                          value={line.quantity}
                          onChange={(event) => setLineQty(line.option.variantId, Number(event.target.value) || 1)}
                          aria-label={`Quantity for ${line.option.productName}`}
                        />
                      </td>
                      <td className="num tabular">{formatPrice(line.option.sellPrice)}</td>
                      <td className="num tabular">{formatPrice(amount)}</td>
                      <td>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Remove ${line.option.productName}`}
                          onClick={() => setLines((current) => current.filter((entry) => entry !== line))}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="invoice-add-section">
          <button
            type="button"
            className="invoice-add-toggle"
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen((open) => !open)}
            disabled={!branchId}
          >
            <Plus size={16} aria-hidden="true" />
            {pickerOpen ? 'Hide product picker' : 'Add line item'}
          </button>
          {pickerOpen && branchId && <InvoiceLinePicker branchId={branchId} inCart={inCart} onAdd={add} />}
          {!branchId && <p className="invoice-muted">Choose a branch before adding items.</p>}
        </div>

        <footer className="invoice-sheet-footer">
          <div className="invoice-notes">
            <label htmlFor="invoice-notes">Notes / payment terms</label>
            <textarea
              id="invoice-notes"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional terms, PO reference, or delivery note"
            />
          </div>
          <div className="invoice-sheet-aside">
            <div className="invoice-totals">
              <dl>
                <div>
                  <dt>Items</dt>
                  <dd className="tabular">{units}</dd>
                </div>
                <div className="invoice-total-row">
                  <dt>Total due</dt>
                  <dd className="tabular">{formatPrice(subtotal)}</dd>
                </div>
              </dl>
            </div>
            <div className="invoice-payment-wrap">
              <PaymentFields draft={payment} total={subtotal} onChange={setPayment} totalLabel="Invoice total" />
            </div>
          </div>
        </footer>

        <p className="invoice-footnote">
          Wholesale document — stock and accounts sync when the wholesale API is connected.
        </p>
      </article>
    </div>
  )
}
