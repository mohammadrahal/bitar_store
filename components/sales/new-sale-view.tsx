'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { CircleCheck, MapPin, Pause, Printer, ShoppingBag, Trash2, UserPlus } from 'lucide-react'
import { LineDiscountField, type LineDiscount } from '@/components/sales/line-discount'
import { QtyStepper } from '@/components/sales/qty-stepper'
import { CashSessionGate } from '@/components/cash/cash-session-gate'
import { PaymentFields } from '@/components/sales/payment-fields'
import { SaleFooter } from '@/components/sales/sale-footer'
import { TillCatalog } from '@/components/sales/till-catalog'
import { SaleChannelFields } from '@/components/sales/sale-channel-fields'
import type { ApiSaleChannel, ApiSocialPlatform } from '@/lib/api/types'
import { SALE_CHANNEL_OPTIONS, SOCIAL_PLATFORM_OPTIONS } from '@/lib/sale-channel'
import { Field } from '@/components/shared/field'
import { LocationSelect } from '@/components/shared/location-select'
import { PageHeader } from '@/components/shared/page-header'
import { ViewOnlyNotice } from '@/components/shared/view-only-notice'
import { receiptFromSale } from '@/components/sales/sale-receipt-build'
import { printSaleReceipt, type ReceiptPrintInput } from '@/components/sales/sale-receipt-print'
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
import { useExchangeRate } from '@/hooks/use-settings'
import { emptyPayment, paymentProblem, paymentsFor, syncTendered, type PaymentDraft } from '@/lib/sale-payments'
import type { VariantOption } from '@/types'

interface CartLine {
  option: VariantOption
  quantity: number
  discount?: LineDiscount
}

interface SaleDraft {
  lines: CartLine[]
  customerName: string
  customerPhone: string
  channel: ApiSaleChannel
  socialPlatform: ApiSocialPlatform
  payment: PaymentDraft
  pendingDraftId: string | null
}

function emptyDraft(): SaleDraft {
  return {
    lines: [],
    customerName: '',
    customerPhone: '',
    channel: 'in_store',
    socialPlatform: 'whatsapp',
    payment: emptyPayment(),
    pendingDraftId: null,
  }
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

/** Lines restored from a pending sale carry no stock figure; the server checks those on submit. */
function lineMax(line: CartLine): number {
  const available = line.option.available ?? 0
  return available > 0 ? available : 9999
}

function draftUnits(draft: SaleDraft): number {
  return draft.lines.reduce((sum, line) => sum + line.quantity, 0)
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
  const [draft, setDraft] = useState<SaleDraft>(() => emptyDraft())
  const [held, setHeld] = useState<SaleDraft | null>(null)
  const [lastCompleted, setLastCompleted] = useState<{
    reference: string
    href: string
    receipt: ReceiptPrintInput
  } | null>(null)
  const [customerOpen, setCustomerOpen] = useState(false)
  const branchId = locationScoped ? defaultBranch : branchChoice

  const { lines, customerName, customerPhone, channel, socialPlatform, payment, pendingDraftId } = draft

  const resetDraft = () => {
    idempotency.reset()
    setDraft(emptyDraft())
    setCustomerOpen(false)
    if (searchParams.get('pending')) router.replace('/sales/new')
  }

  const holdAndStartNext = () => {
    if (lines.length === 0) return
    if (held) {
      toast.message('Resume the held sale first, or finish it, before holding another.')
      return
    }
    setHeld(draft)
    resetDraft()
    toast.success('Sale held. Ring up the next customer, then tap Resume held sale.')
  }

  const resumeHeld = () => {
    if (!held) return
    if (lines.length > 0) {
      toast.message('Finish or hold the current sale before resuming the held one.')
      return
    }
    setDraft(held)
    setHeld(null)
  }

  useEffect(() => {
    const draftId = searchParams.get('pending')
    if (!draftId) return
    const pending = getPendingSale(draftId)
    if (!pending) return
    if (!locationScoped) setBranch(pending.branchId)
    setDraft({
      ...emptyDraft(),
      pendingDraftId: pending.id,
      customerName: pending.customerName?.trim() || pending.note?.trim() || '',
      customerPhone: pending.customerPhone?.trim() || '',
      lines: pending.lines.map((line) => ({ option: optionFromPendingLine(line), quantity: line.quantity })),
    })
  }, [searchParams, locationScoped])

  const mayApplyDiscount = can('discounts.apply', branchId || undefined)
  const drawerBlocks = useDrawerBlocksSale(branchId || undefined)
  const rateQuery = useExchangeRate()

  const total = fromCents(lines.reduce((sum, line) => sum + lineNet(line), 0))
  const units = lines.reduce((sum, line) => sum + line.quantity, 0)
  const inCart = Object.fromEntries(lines.map((line) => [line.option.variantId, line.quantity]))

  useEffect(() => {
    setDraft((current) => ({ ...current, payment: syncTendered(current.payment, total, rateQuery.rate) }))
  }, [total, rateQuery.rate])

  const problem =
    paymentProblem(payment, total, rateQuery.rate) ??
    (channel === 'social_media' && !socialPlatform ? 'Choose a social platform.' : null)
  const referenceError = isConflict(create.error) ? messageOf(create.error) : undefined

  const setLines = (next: CartLine[] | ((current: CartLine[]) => CartLine[])) => {
    setDraft((current) => ({
      ...current,
      lines: typeof next === 'function' ? next(current.lines) : next,
    }))
  }

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
          setDraft((current) => ({ ...current, pendingDraftId: sale.id }))
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
          channel,
          socialPlatform: channel === 'social_media' ? socialPlatform : undefined,
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
          payments: paymentsFor(payment, total, rateQuery.rate),
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
          const receipt: ReceiptPrintInput = { ...receiptFromSale(sale, user.name), branchName, customerName: name }
          let receiptHref = `/sales/${sale.id}`
          try {
            const invoice = await createB2cInvoiceForSale(sale.id, {
              name,
              phone,
              note: customerName.trim() || undefined,
            })
            receiptHref = `/sales/invoices/${invoice.id}`
          } catch {
            /* Fiscal invoice optional; the till sale is still the receipt of record. */
          }
          setLastCompleted({ reference: sale.reference, href: receiptHref, receipt })
          resetDraft()
          toast.success(`${sale.reference} completed.`)
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

  const channelLabel =
    channel === 'social_media'
      ? (SOCIAL_PLATFORM_OPTIONS.find((option) => option.value === socialPlatform)?.label ?? 'Social media')
      : (SALE_CHANNEL_OPTIONS.find((option) => option.value === channel)?.label ?? 'In store')

  const clearCart = () => {
    const cleared = lines
    setLines([])
    toast('Cart cleared', { action: { label: 'Undo', onClick: () => setLines(cleared) } })
  }

  const setQuantity = (line: CartLine, quantity: number) =>
    setLines((current) => current.map((entry) => (entry === line ? { ...entry, quantity } : entry)))

  const chooseBranch = (value: string) => {
    setBranch(value)
    setDraft((current) => ({ ...current, lines: [] }))
  }

  return (
    <form className="sale-layout sale-layout--till" onSubmit={submit} noValidate>
      <PageHeader
        title="New sale"
        actions={
          <>
            {!locationScoped && branchId ? (
              <div className="sale-location-inline">
                <MapPin size={16} aria-hidden="true" />
                <LocationSelect
                  value={branchChoice}
                  onChange={chooseBranch}
                  onlyAccessible
                  onlyFullAccess
                  aria-label="Selling location"
                />
              </div>
            ) : null}
            {lines.length > 0 ? (
              <button type="button" className="btn btn-secondary" onClick={holdAndStartNext}>
                <Pause size={16} aria-hidden="true" />
                Hold for next
              </button>
            ) : null}
          </>
        }
      />

      {held || lastCompleted ? (
        <div className="sale-status-row">
          {held ? (
            <div className="sale-status sale-status--held" role="status">
              <Pause size={16} aria-hidden="true" />
              <span>
                Held sale · {draftUnits(held)} {draftUnits(held) === 1 ? 'item' : 'items'}
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={resumeHeld}
                disabled={lines.length > 0}
                title={lines.length > 0 ? 'Finish or hold the current sale first' : undefined}
              >
                Resume
              </button>
            </div>
          ) : null}
          {lastCompleted ? (
            <div className="sale-status sale-status--done" role="status">
              <CircleCheck size={16} aria-hidden="true" />
              <span>
                <strong className="tabular">{lastCompleted.reference}</strong> completed
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => printSaleReceipt(lastCompleted.receipt)}
              >
                <Printer size={14} aria-hidden="true" />
                Print receipt
              </button>
              <Link href={lastCompleted.href} className="text-link">
                {lastCompleted.href.startsWith('/sales/invoices/') ? 'View invoice' : 'View sale'}
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <ViewOnlyNotice locationId={branchId} action="ring up sales" />
      <CashSessionGate branchId={branchId} />

      <div className="sale-till-grid">
        <section className="sale-panel sale-panel--catalog" aria-label="Products">
          {branchId ? (
            <TillCatalog branchId={branchId} inCart={inCart} onAdd={add} />
          ) : (
            <div className="sale-catalog-empty">
              <span className="sale-catalog-empty-icon" aria-hidden="true">
                <MapPin size={22} />
              </span>
              <h2>Where are you selling from?</h2>
              <p>Products and stock depend on the location. Pick one to load the catalog.</p>
              {!locationScoped ? (
                <Field label="Selling location" className="sale-catalog-empty-field">
                  <LocationSelect value={branchChoice} onChange={chooseBranch} onlyAccessible onlyFullAccess />
                </Field>
              ) : null}
            </div>
          )}
        </section>

        <aside className="sale-ticket" aria-label="This sale">
          <header className="sale-ticket-head">
            <h2 className="sale-staged-title">Cart</h2>
            {lines.length > 0 ? (
              <>
                <span className="sale-staged-count">{lineCountLabel}</span>
                <button type="button" className="text-btn sale-ticket-clear" onClick={clearCart}>
                  Clear
                </button>
              </>
            ) : null}
          </header>

          <div className="sale-ticket-body">
            {lines.length === 0 ? (
              <div className="sale-staged-empty">
                <ShoppingBag size={22} aria-hidden="true" />
                <strong>The cart is empty</strong>
                <span>Scan a tag, or tap a product and then a size.</span>
              </div>
            ) : (
              <ul className="sale-staged-lines">
                {lines.map((line) => (
                  <li key={line.option.variantId} className="sale-staged-line-wrap">
                    <div className="sale-staged-line">
                      <span className="sale-staged-line-label">
                        <strong>{line.option.productName}</strong>
                        <small>
                          {line.option.color} / {line.option.size} · {formatPrice(line.option.sellPrice)} each
                        </small>
                      </span>
                      <span className="tabular sale-staged-line-price">{formatPrice(fromCents(lineNet(line)))}</span>
                      <button
                        type="button"
                        className="icon-btn sale-staged-line-remove"
                        aria-label={`Remove ${line.option.productName} ${line.option.color} / ${line.option.size}`}
                        onClick={() => setLines((current) => current.filter((entry) => entry !== line))}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="sale-staged-line-tools">
                      <QtyStepper
                        compact
                        hideHint
                        value={line.quantity}
                        max={lineMax(line)}
                        label={`Quantity of ${line.option.productName} ${line.option.color} / ${line.option.size}`}
                        onChange={(quantity) => setQuantity(line, quantity)}
                      />
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
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <details
              className="sale-ticket-details sale-ticket-section"
              open={customerOpen}
              onToggle={(event) => setCustomerOpen(event.currentTarget.open)}
            >
              <summary>
                {customerName.trim() || customerPhone.trim() ? (
                  <>
                    Customer <span>{customerName.trim() || customerPhone.trim()}</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={16} aria-hidden="true" /> Add customer (optional)
                  </>
                )}
              </summary>
              <div className="form-grid sale-customer-grid">
                <Field label="Name">
                  <input
                    value={customerName}
                    onChange={(event) => setDraft((current) => ({ ...current, customerName: event.target.value }))}
                    autoComplete="name"
                    placeholder="Walk-in"
                  />
                </Field>
                <Field label="Phone">
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(event) => setDraft((current) => ({ ...current, customerPhone: event.target.value }))}
                    autoComplete="tel"
                    placeholder="+961 …"
                    inputMode="tel"
                    className="tabular"
                  />
                </Field>
              </div>
            </details>

            {lines.length > 0 ? (
              <section className="sale-ticket-section" aria-labelledby="sale-payment-heading">
                <h3 id="sale-payment-heading" className="sale-ticket-subhead">
                  Payment
                </h3>
                <PaymentFields
                  draft={payment}
                  total={total}
                  onChange={(next) => setDraft((current) => ({ ...current, payment: next }))}
                  referenceError={referenceError}
                  showRateHint={false}
                  embedded
                />
                <details className="sale-ticket-details">
                  <summary>
                    Sold through <span>{channelLabel}</span>
                  </summary>
                  <SaleChannelFields
                    channel={channel}
                    socialPlatform={socialPlatform}
                    onChannelChange={(next) => {
                      setDraft((current) => ({
                        ...current,
                        channel: next,
                        socialPlatform: next === 'in_store' ? 'whatsapp' : current.socialPlatform,
                      }))
                    }}
                    onSocialPlatformChange={(platform) =>
                      setDraft((current) => ({ ...current, socialPlatform: platform }))
                    }
                  />
                </details>
              </section>
            ) : null}
          </div>

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
        </aside>
      </div>
    </form>
  )
}
