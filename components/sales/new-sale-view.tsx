'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { LineDiscountField, type LineDiscount } from '@/components/sales/line-discount'
import { CashSessionGate } from '@/components/cash/cash-session-gate'
import { PaymentFields } from '@/components/sales/payment-fields'
import { SaleFooter } from '@/components/sales/sale-footer'
import { CatalogLinePicker } from '@/components/sales/catalog-line-picker'
import { Field } from '@/components/shared/field'
import { LocationSelect } from '@/components/shared/location-select'
import { PageHeader } from '@/components/shared/page-header'
import { ViewOnlyNotice } from '@/components/shared/view-only-notice'
import { receiptFromSale } from '@/components/sales/sale-receipt-build'
import { printSaleReceipt } from '@/components/sales/sale-receipt-print'
import { useDefaultBranchId } from '@/hooks/use-branch-scope'
import { useBranches } from '@/hooks/use-branches'
import { useCurrentUser } from '@/store/user-store'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { useSavePendingSale } from '@/hooks/use-pending-sales'
import { useCreateSale } from '@/hooks/use-sales'
import { useDrawerBlocksSale } from '@/hooks/use-cash-sessions'
import { createB2cInvoiceForSale } from '@/services/invoices-api.service'
import { getPendingSale } from '@/services/pending-sales.service'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { usePermission } from '@/hooks/use-permission'
import { isConflict, messageOf } from '@/lib/errors'
import { formatPrice } from '@/lib/format'
import { fromCents, toCents } from '@/lib/money'
import { emptyPayment, paymentProblem, paymentsFor, syncTendered, type PaymentDraft } from '@/lib/sale-payments'
import type { VariantOption } from '@/types'

interface CartLine {
  option: VariantOption
  quantity: number
  discount?: LineDiscount
}

function lineNet(line: CartLine): number {
  const gross = line.quantity * toCents(line.option.sellPrice)
  const off = line.discount ? Math.round((gross * line.discount.percent) / 100) : 0
  return Math.max(0, gross - off)
}

function optionFromPendingLine(line: { skuId: string; label: string; unitPrice: number }): VariantOption {
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

export function NewSaleView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { can, locationScoped } = usePermission()
  const online = useOnlineStatus()
  const defaultBranch = useDefaultBranchId()
  const user = useCurrentUser()
  const { data: branches } = useBranches()
  const create = useCreateSale()
  const savePending = useSavePendingSale()
  const idempotency = useIdempotencyKey()

  const [branchChoice, setBranch] = useState('')
  const [lines, setLines] = useState<CartLine[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [payment, setPayment] = useState<PaymentDraft>(emptyPayment)
  const [pendingDraftId, setPendingDraftId] = useState<string | null>(null)
  const branchId = locationScoped ? defaultBranch : branchChoice

  useEffect(() => {
    const draftId = searchParams.get('pending')
    if (!draftId) return
    const draft = getPendingSale(draftId)
    if (!draft) return
    if (!locationScoped) setBranch(draft.branchId)
    setPendingDraftId(draft.id)
    setCustomerName(draft.customerName?.trim() || draft.note?.trim() || '')
    setCustomerPhone(draft.customerPhone?.trim() || '')
    setLines(draft.lines.map((line) => ({ option: optionFromPendingLine(line), quantity: line.quantity })))
  }, [searchParams, locationScoped])

  const mayApplyDiscount = can('discounts.apply', branchId || undefined)
  /* `requireOpenCashSession` with no open drawer: `POST /sales` would answer
     409, so the sale is held here instead of at the last step. */
  const drawerBlocks = useDrawerBlocksSale(branchId || undefined)

  const total = fromCents(lines.reduce((sum, line) => sum + lineNet(line), 0))
  const units = lines.reduce((sum, line) => sum + line.quantity, 0)
  const inCart = Object.fromEntries(lines.map((line) => [line.option.variantId, line.quantity]))

  /* Cash received follows the sale total until the cashier types a larger bill. */
  useEffect(() => {
    setPayment((current) => syncTendered(current, total))
  }, [total])

  const problem = paymentProblem(payment, total)
  /* The server refuses a Whish reference it has already recorded. */
  const referenceError = isConflict(create.error) ? messageOf(create.error) : undefined

  const add = (option: VariantOption, quantity: number) =>
    setLines((current) => {
      const existing = current.find((line) => line.option.variantId === option.variantId)
      if (!existing) return [...current, { option, quantity }]
      return current.map((line) => (line === existing ? { ...line, quantity: line.quantity + quantity } : line))
    })

  const saveAsPending = () => {
    if (!branchId || lines.length === 0) return
    savePending.mutate(
      {
        id: pendingDraftId ?? undefined,
        branchId,
        note: customerName.trim(),
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        lines: lines.map((line) => ({
          skuId: line.option.variantId,
          label: `${line.option.productName} · ${line.option.color} / ${line.option.size}`,
          quantity: line.quantity,
          unitPrice: line.option.sellPrice,
        })),
      },
      {
        onSuccess: (sale) => {
          setPendingDraftId(sale.id)
          toast.success('Pending sale saved. Complete payment at the till when ready')
          router.push('/sales/b2c')
        },
      },
    )
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (lines.length === 0 || problem) return
    create.mutate(
      {
        input: {
          branchId,
          note: customerName.trim() || undefined,
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          lines: lines.map((line) => ({
            skuId: line.option.variantId,
            quantity: line.quantity,
            unitPrice: line.option.sellPrice,
            discountPercent: line.discount?.percent,
            discountReason: line.discount?.reason,
          })),
          payments: paymentsFor(payment, total),
        },
        idempotencyKey: idempotency.current(),
      },
      {
        onSuccess: async (sale) => {
          idempotency.reset()
          if (pendingDraftId) {
            import('@/services/pending-sales.service').then(({ deletePendingSale }) => {
              deletePendingSale(pendingDraftId)
            })
          }
          const branchName = branches?.find((branch) => branch.id === sale.branchId)?.name
          const name = customerName.trim() || sale.customerName?.trim() || undefined
          const phone = customerPhone.trim() || sale.customerPhone?.trim() || undefined
          printSaleReceipt({
            ...receiptFromSale(sale, user.name),
            branchName,
            customerName: name,
          })
          try {
            const invoice = await createB2cInvoiceForSale(sale.id, {
              name,
              phone,
              note: customerName.trim() || undefined,
            })
            router.push(`/sales/invoices/${invoice.id}`)
          } catch {
            router.push(`/sales/${sale.id}`)
          }
        },
      },
    )
  }

  const lineCountLabel =
    lines.length === 0
      ? '0 line items'
      : lines.length === 1
        ? '1 line item'
        : `${lines.length} line items`

  return (
    <form className="sale-layout sale-layout--till" onSubmit={submit} noValidate>
      <PageHeader eyebrow="Sales" title="New sale" />
      {!locationScoped && (
        <Field label="Selling from" className="sale-location-field">
          <LocationSelect
            value={branchChoice}
            onChange={(value) => {
              setBranch(value)
              setLines([])
            }}
            onlyAccessible
            onlyFullAccess
          />
        </Field>
      )}

      <ViewOnlyNotice locationId={branchId} action="ring up sales" />
      <CashSessionGate branchId={branchId} />

      <div className="sale-till-stack">
        <section className="sale-panel sale-panel--catalog" aria-label="Product catalog">
          {branchId ? (
            <CatalogLinePicker
              branchId={branchId}
              inCart={inCart}
              onAdd={add}
              availability="enforce"
              addLabel="Add to sale"
              searchPlaceholder="Search model, code or SKU"
              searchAriaLabel="Search models for sale"
              itemLabel="add to sale"
              className="catalog-picker catalog-picker--sale"
              pickerUi="till"
            />
          ) : (
            <p className="muted">Choose the selling location above before adding items.</p>
          )}
        </section>

        <section className="sale-panel sale-panel--staged" aria-label="Staged items">
          <header className="sale-staged-head">
            <h2 className="sale-staged-title">Staged items</h2>
            <span className="sale-staged-count">{lineCountLabel}</span>
          </header>
          {lines.length === 0 ? (
            <p className="sale-staged-empty muted">Nothing staged yet. Open a product and add a variant.</p>
          ) : (
            <>
              <ul className="sale-staged-lines">
                {lines.map((line) => (
                  <li key={line.option.variantId} className="sale-staged-line-wrap">
                    <div className="sale-staged-line">
                      <span className="sale-staged-line-label">
                        {line.quantity}× {line.option.productName} {line.option.color} / {line.option.size}
                      </span>
                      <span className="row-actions sale-staged-line-actions">
                        <span className="tabular sale-staged-line-price">{formatPrice(fromCents(lineNet(line)))}</span>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Remove ${line.option.productName} ${line.option.color} / ${line.option.size}`}
                          onClick={() => setLines((current) => current.filter((entry) => entry !== line))}
                        >
                          <Trash2 size={16} />
                        </button>
                      </span>
                    </div>
                    <LineDiscountField
                      lineTotal={line.quantity * line.option.sellPrice}
                      mayApply={mayApplyDiscount}
                      value={line.discount}
                      onChange={(discount) =>
                        setLines((current) =>
                          current.map((entry) => (entry === line ? { ...entry, discount } : entry)),
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
              <div className="form-grid sale-customer-grid">
                <Field label="Customer name (optional)">
                  <input
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    autoComplete="name"
                    placeholder="Walk-in customer"
                  />
                </Field>
                <Field label="Phone number (optional)">
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    autoComplete="tel"
                    placeholder="+961 70 000 000"
                    inputMode="tel"
                    className="tabular"
                  />
                </Field>
              </div>
            </>
          )}
        </section>
      </div>

      {lines.length > 0 && (
        <PaymentFields
          draft={payment}
          total={total}
          onChange={setPayment}
          referenceError={referenceError}
          showRateHint={false}
        />
      )}

      <SaleFooter
        total={total}
        units={units}
        pending={create.isPending}
        disabled={lines.length === 0 || !online || !branchId || Boolean(problem) || drawerBlocks}
        problem={
          drawerBlocks
            ? 'Open the cash drawer before completing a sale.'
            : lines.length > 0
              ? (problem ?? undefined)
              : undefined
        }
        onSavePending={branchId && lines.length > 0 ? saveAsPending : undefined}
        savingPending={savePending.isPending}
      />
    </form>
  )
}
