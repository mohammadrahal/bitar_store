'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { LineDiscountField, type LineDiscount } from '@/components/sales/line-discount'
import { PaymentFields } from '@/components/sales/payment-fields'
import { SaleFooter } from '@/components/sales/sale-footer'
import { SaleItemCard } from '@/components/sales/sale-item-card'
import { Field } from '@/components/shared/field'
import { LocationSelect } from '@/components/shared/location-select'
import { PageHeader } from '@/components/shared/page-header'
import { useDefaultBranchId } from '@/hooks/use-branch-scope'
import { useOpenDiscountRequests, useRequestDiscount } from '@/hooks/use-discount-requests'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { useCreateSale } from '@/hooks/use-sales'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { usePermission } from '@/hooks/use-permission'
import { ApiError } from '@/lib/api/api-error'
import { formatPrice } from '@/lib/format'
import { fromCents, toCents } from '@/lib/invoice-totals'
import { emptyPayment, paymentProblem, paymentsFor, type PaymentDraft } from '@/lib/sale-payments'
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
  const requestDiscount = useRequestDiscount()
  const idempotency = useIdempotencyKey()

  const [branchChoice, setBranch] = useState('')
  const [lines, setLines] = useState<CartLine[]>([])
  const [customer, setCustomer] = useState('')
  const [payment, setPayment] = useState<PaymentDraft>(emptyPayment)
  const branchId = locationScoped ? defaultBranch : branchChoice

  const mayApplyDiscount = can('discounts.apply', branchId || undefined)
  const mayRequestDiscount = can('discounts.request', branchId || undefined)
  const { data: discountRequests } = useOpenDiscountRequests(branchId)

  const total = fromCents(lines.reduce((sum, line) => sum + lineNet(line), 0))
  const units = lines.reduce((sum, line) => sum + line.quantity, 0)
  const inCart = Object.fromEntries(lines.map((line) => [line.option.variantId, line.quantity]))

  /* A split the cashier has not touched yet should still add up, so the cash
     part follows the total until they move money to Whish. */
  useEffect(() => {
    setPayment((current) =>
      current.mode === 'split' && toCents(current.cashAmount) + toCents(current.whishAmount) !== toCents(total)
        ? current
        : { ...current, cashAmount: current.mode === 'split' ? current.cashAmount : total },
    )
  }, [total])

  const requestFor = (variantId: string) =>
    discountRequests?.find((request) => request.variantId === variantId)

  /* An ask nobody has decided yet blocks the sale: the price is not settled. */
  const awaitingApproval = lines.some((line) => requestFor(line.option.variantId)?.status === 'pending')

  const effectiveLines = useMemo(
    () =>
      lines.map((line) => {
        const approved = discountRequests?.find(
          (request) => request.variantId === line.option.variantId && request.status === 'approved',
        )
        return approved ? { ...line, discount: { percent: approved.percent, reason: approved.reason } } : line
      }),
    [lines, discountRequests],
  )

  const approvedTotal = fromCents(effectiveLines.reduce((sum, line) => sum + lineNet(line), 0))
  const problem = paymentProblem(payment, approvedTotal)
  const referenceError =
    create.error instanceof ApiError && create.error.status === 409 ? create.error.message : undefined

  const add = (option: VariantOption, quantity: number) =>
    setLines((current) => {
      const existing = current.find((line) => line.option.variantId === option.variantId)
      if (!existing) return [...current, { option, quantity }]
      return current.map((line) => (line === existing ? { ...line, quantity: line.quantity + quantity } : line))
    })

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (effectiveLines.length === 0 || problem || awaitingApproval) return
    create.mutate(
      {
        input: {
          branchId,
          note: customer.trim() || undefined,
          lines: effectiveLines.map((line) => ({
            skuId: line.option.variantId,
            quantity: line.quantity,
            unitPrice: line.option.sellPrice,
            discountPercent: line.discount?.percent,
            discountReason: line.discount?.reason,
          })),
          payments: paymentsFor(payment, approvedTotal),
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
          />
        </Field>
      )}

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
                  variantId={line.option.variantId}
                  mayApply={mayApplyDiscount}
                  mayRequest={mayRequestDiscount}
                  value={line.discount}
                  request={requestFor(line.option.variantId)}
                  pending={requestDiscount.isPending}
                  onChange={(discount) =>
                    setLines((current) =>
                      current.map((entry) => (entry === line ? { ...entry, discount } : entry)),
                    )
                  }
                  onRequest={(variantId, discount) =>
                    requestDiscount.mutate({
                      branchId,
                      variantId,
                      percent: discount.percent,
                      reason: discount.reason,
                    })
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
          total={approvedTotal}
          onChange={setPayment}
          referenceError={referenceError}
        />
      )}

      <SaleFooter
        total={approvedTotal}
        units={units}
        pending={create.isPending}
        disabled={lines.length === 0 || !online || !branchId || Boolean(problem) || awaitingApproval}
        problem={
          awaitingApproval
            ? 'A requested discount is still waiting for approval.'
            : lines.length > 0
              ? (problem ?? undefined)
              : undefined
        }
      />
    </form>
  )
}
