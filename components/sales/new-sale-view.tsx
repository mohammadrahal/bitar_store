'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { SaleFooter } from '@/components/sales/sale-footer'
import { SaleItemCard } from '@/components/sales/sale-item-card'
import { Field } from '@/components/shared/field'
import { LocationSelect } from '@/components/shared/location-select'
import { PageHeader } from '@/components/shared/page-header'
import { useDefaultBranchId } from '@/hooks/use-branch-scope'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { useCreateInvoice } from '@/hooks/use-invoices'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { usePermission } from '@/hooks/use-permission'
import { formatPrice, todayAsDateInput } from '@/lib/format'
import { invoiceTotals } from '@/lib/invoice-totals'
import type { VariantOption } from '@/types'

interface CartLine {
  option: VariantOption
  quantity: number
}

export function NewSaleView() {
  const router = useRouter()
  const { can, branchScoped } = usePermission()
  const online = useOnlineStatus()
  const defaultBranch = useDefaultBranchId()
  const create = useCreateInvoice()
  const idempotency = useIdempotencyKey()

  const [branchChoice, setBranch] = useState<string | null>(null)
  const [lines, setLines] = useState<CartLine[]>([])
  const [customer, setCustomer] = useState('')
  const [discount, setDiscount] = useState(0)
  const branchId = branchChoice ?? defaultBranch
  const canDiscount = can('sales:discount')

  const totals = invoiceTotals(lines.map((line) => ({ quantity: line.quantity, unitPrice: line.option.sellPrice })), discount)
  const inCart = Object.fromEntries(lines.map((line) => [line.option.variantId, line.quantity]))

  const add = (option: VariantOption, quantity: number) =>
    setLines((current) => {
      const existing = current.find((line) => line.option.variantId === option.variantId)
      if (!existing) return [...current, { option, quantity }]
      return current.map((line) => (line === existing ? { ...line, quantity: line.quantity + quantity } : line))
    })

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (lines.length === 0) return
    create.mutate(
      {
        input: {
          kind: 'sale',
          branchId,
          partyName: customer.trim() || 'Walk-in customer',
          issuedAt: todayAsDateInput(),
          discount: canDiscount ? totals.discount : 0,
          salesChannel: 'b2c',
          lines: lines.map((line) => ({ variantId: line.option.variantId, quantity: line.quantity, unitPrice: line.option.sellPrice })),
        },
        issue: true,
        key: idempotency.current(),
      },
      {
        onSuccess: (invoice) => {
          idempotency.reset()
          router.push(`/invoices/${invoice.id}`)
        },
      },
    )
  }

  return (
    <form className="sale-layout" onSubmit={submit} noValidate>
      <PageHeader eyebrow="Sales" title="New sale" />
      {!branchScoped && (
        <Field label="Selling from">
          <LocationSelect value={branchId} onChange={(value) => { setBranch(value); setLines([]) }} onlyAccessible />
        </Field>
      )}

      <SaleItemCard branchId={branchId} inCart={inCart} onAdd={add} />

      {lines.length > 0 && (
        <section className="sale-card" aria-label="Items on this sale">
          <ul className="sale-lines">
            {lines.map((line) => (
              <li key={line.option.variantId}>
                <span>
                  {line.quantity} × {line.option.productName} {line.option.color} / {line.option.size}
                </span>
                <span className="row-actions">
                  <span className="tabular">{formatPrice(line.quantity * line.option.sellPrice)}</span>
                  <button type="button" className="icon-btn" aria-label={`Remove ${line.option.productName} ${line.option.color} / ${line.option.size}`} onClick={() => setLines((current) => current.filter((entry) => entry !== line))}>
                    <Trash2 size={16} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <Field label="Customer (optional)">
            <input value={customer} onChange={(event) => setCustomer(event.target.value)} autoComplete="off" placeholder="Walk-in customer" />
          </Field>
          {canDiscount ? (
            <Field label="Discount" hint={`Up to ${formatPrice(totals.subtotal)}`}>
              <input type="number" min="0" step="0.01" inputMode="decimal" value={discount || ''} onChange={(event) => setDiscount(Math.max(0, Number(event.target.value) || 0))} />
            </Field>
          ) : (
            <p className="muted">Discounts are applied by a manager.</p>
          )}
        </section>
      )}

      <SaleFooter total={totals.total} units={totals.units} pending={create.isPending} disabled={lines.length === 0 || !online || !branchId} />
    </form>
  )
}
