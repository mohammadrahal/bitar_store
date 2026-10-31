'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { LineDiscountField, type LineDiscount } from '@/components/sales/line-discount'
import { PaymentFields } from '@/components/sales/payment-fields'
import { SaleFooter } from '@/components/sales/sale-footer'
import { SaleItemCard } from '@/components/sales/sale-item-card'
import { Field } from '@/components/shared/field'
import { LocationSelect } from '@/components/shared/location-select'
import { PageHeader } from '@/components/shared/page-header'
import { ViewOnlyNotice } from '@/components/shared/view-only-notice'
import { useDefaultBranchId } from '@/hooks/use-branch-scope'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { useCreateSale } from '@/hooks/use-sales'
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

export function NewSaleView() {
  const router = useRouter()
  const { can, locationScoped } = usePermission()
  const online = useOnlineStatus()
  const defaultBranch = useDefaultBranchId()
  const create = useCreateSale()
  const idempotency = useIdempotencyKey()

  const [branchChoice, setBranch] = useState('')
  const [lines, setLines] = useState<CartLine[]>([])
  const [customer, setCustomer] = useState('')
  const [payment, setPayment] = useState<PaymentDraft>(emptyPayment)
  const branchId = locationScoped ? defaultBranch : branchChoice

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

      <SaleItemCard branchId={branchId} inCart={inCart} onAdd={add} />

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
      />
    </form>
  )
}
