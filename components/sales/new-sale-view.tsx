'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { LineDiscountField, type LineDiscount } from '@/components/sales/line-discount'
import { PaymentFields } from '@/components/sales/payment-fields'
import { SaleFooter } from '@/components/sales/sale-footer'
import { CatalogLinePicker } from '@/components/sales/catalog-line-picker'
import { Field } from '@/components/shared/field'
import { LocationSelect } from '@/components/shared/location-select'
import { PageHeader } from '@/components/shared/page-header'
import { ViewOnlyNotice } from '@/components/shared/view-only-notice'
import { useDefaultBranchId } from '@/hooks/use-branch-scope'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { useSavePendingSale } from '@/hooks/use-pending-sales'
import { useCreateSale } from '@/hooks/use-sales'
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
  const create = useCreateSale()
  const savePending = useSavePendingSale()
  const idempotency = useIdempotencyKey()

  const [branchChoice, setBranch] = useState('')
  const [lines, setLines] = useState<CartLine[]>([])
  const [customer, setCustomer] = useState('')
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
    setCustomer(draft.note)
    setLines(draft.lines.map((line) => ({ option: optionFromPendingLine(line), quantity: line.quantity })))
  }, [searchParams, locationScoped])

  const mayApplyDiscount = can('discounts.apply', branchId || undefined)

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
        note: customer.trim(),
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
          toast.success('Pending sale saved — complete payment at the till when ready')
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
          note: customer.trim() || undefined,
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
        onSuccess: (sale) => {
          idempotency.reset()
          if (pendingDraftId) {
            import('@/services/pending-sales.service').then(({ deletePendingSale }) => {
              deletePendingSale(pendingDraftId)
            })
          }
          router.push(`/sales/${sale.id}`)
        },
      },
    )
  }

  return (
    <form className="sale-layout" onSubmit={submit} noValidate>
      <PageHeader eyebrow="Sales" title="New sale" />
      {!locationScoped && (
        <Field label="Selling from">
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

      <section className="sale-card" aria-label="Add an item">
        {branchId ? (
          <CatalogLinePicker
            branchId={branchId}
            inCart={inCart}
            onAdd={add}
            enforceStock
            addLabel="Add to sale"
            searchPlaceholder="Search model, code or SKU"
            searchAriaLabel="Search models for sale"
            itemLabel="add to sale"
            className="catalog-picker catalog-picker--sale"
          />
        ) : (
          <p className="muted">Choose the selling location above before adding items.</p>
        )}
      </section>

      {lines.length > 0 && (
        <section className="sale-card" aria-label="Items on this sale">
          <ul className="sale-lines">
            {lines.map((line) => (
              <li key={line.option.variantId} className="sale-line-block">
                <div className="sale-line-head">
                  <span>
                    {line.quantity} × {line.option.productName} {line.option.color} / {line.option.size}
                  </span>
                  <span className="row-actions">
                    <span className="tabular">{formatPrice(fromCents(lineNet(line)))}</span>
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
          <Field label="Customer (optional)">
            <input
              value={customer}
              onChange={(event) => setCustomer(event.target.value)}
              autoComplete="off"
              placeholder="Walk-in customer"
            />
          </Field>
        </section>
      )}

      {lines.length > 0 && (
        <PaymentFields
          draft={payment}
          total={total}
          onChange={setPayment}
          referenceError={referenceError}
        />
      )}

      <SaleFooter
        total={total}
        units={units}
        pending={create.isPending}
        disabled={lines.length === 0 || !online || !branchId || Boolean(problem)}
        problem={lines.length > 0 ? (problem ?? undefined) : undefined}
        onSavePending={branchId && lines.length > 0 ? saveAsPending : undefined}
        savingPending={savePending.isPending}
      />
    </form>
  )
}
