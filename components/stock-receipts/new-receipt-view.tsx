'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Warehouse } from 'lucide-react'
import { Section } from '@/components/products/form-section'
import { EmptyState } from '@/components/shared/empty-state'
import { Field } from '@/components/shared/field'
import { LocationEyebrow, PageHeader } from '@/components/shared/page-header'
import { ReceiveReceiptSummary } from '@/components/stock-receipts/receive-receipt-summary'
import { ReceiptLinePicker } from '@/components/stock-receipts/receipt-line-picker'
import { ReceiptPhotoField } from '@/components/stock-receipts/receipt-photo-field'
import { SupplierPicker } from '@/components/stock-receipts/supplier-picker'
import { useBranches } from '@/hooks/use-branches'
import { useWarehouseId } from '@/hooks/use-inventory'
import { usePostGoodsReceipt } from '@/hooks/use-goods-receipts'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { todayAsDateInput } from '@/lib/format'
import { useCatalogSync } from '@/hooks/use-stock'
import {
  draftTotal,
  draftUnits,
  filledLines,
  validateGoodsReceipt,
  type GoodsReceiptDraft,
} from '@/services/goods-receipts.service'
import { blankLinesForStyle, type ReceiptPhotoDraft, type StockReceiptLine } from '@/services/stock-receipts.service'
import { useCurrentUser } from '@/store/user-store'
import type { ApiSupplier } from '@/lib/api/types'
import { adminHubHref } from '@/lib/admin-hub'
import { inventoryHubHref } from '@/lib/inventory-hub'

/**
 * Recording a supplier delivery.
 *
 * One `POST /goods-receipts`: supplier, their invoice number and its date, and
 * a cost per piece on every line. The warehouse stock grows in the same
 * transaction, so the delivery either lands whole or not at all. it is no
 * longer a run of separate adjustments that could stop half way.
 *
 * There is no location to choose. A delivery arrives at the warehouse and
 * branches are stocked from it by transfer; the endpoint has no branch field,
 * and the server refuses anyone who cannot reach the warehouse.
 */
export function NewReceiptView() {
  const router = useRouter()
  const showCosts = useCurrentUser().canViewCosts
  const post = usePostGoodsReceipt()
  const idempotency = useIdempotencyKey()
  const searchParams = useSearchParams()
  const styleCode = searchParams.get('style')?.trim().toUpperCase() ?? ''

  const { data: warehouseId, isPending: warehousePending } = useWarehouseId()
  const { data: branches } = useBranches()
  const warehouseName = branches?.find((branch) => branch.id === warehouseId)?.name ?? 'the main warehouse'

  const [supplier, setSupplier] = useState<ApiSupplier | null>(null)
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(todayAsDateInput())
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<StockReceiptLine[]>([])
  const [photo, setPhoto] = useState<ReceiptPhotoDraft | undefined>(undefined)

  const catalog = useCatalogSync()
  const prefilled = useRef(false)
  useEffect(() => {
    if (prefilled.current || !styleCode || catalog.data === undefined) return
    const blanks = blankLinesForStyle(styleCode)
    if (blanks.length === 0) return
    prefilled.current = true
    setLines(blanks)
  }, [styleCode, catalog.data])

  const draft: GoodsReceiptDraft = {
    supplierId: supplier?.id,
    supplierName: supplier?.name ?? '',
    supplierInvoiceNumber,
    invoiceDate,
    note,
    lines,
    photo,
  }
  const problem = validateGoodsReceipt(draft)

  const filled = filledLines(lines).length
  const units = draftUnits(lines)
  const totalValue = useMemo(() => draftTotal(lines), [lines])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (problem) return
    /* One key for this delivery, held across retries: a lost answer must replay
       the first receipt rather than receive the goods a second time. */
    post.mutate(
      { draft, idempotencyKey: idempotency.current() },
      {
        onSuccess: ({ receipt }) => {
          idempotency.reset()
          router.push(`/stock-receipts/${receipt.id}`)
        },
      },
    )
  }

  if (!warehousePending && !warehouseId) {
    return (
      <>
        <Link href={inventoryHubHref('receive-stock')} className="back-link">
          <ArrowLeft size={16} aria-hidden="true" />
          Receive stock
        </Link>
        <EmptyState
          icon={Warehouse}
          title="No warehouse yet"
          description="A supplier delivery is recorded into the main warehouse, and this network does not have one. An admin can mark a location as the warehouse in Locations."
          action={
            <Link href={adminHubHref('locations')} className="btn btn-primary">
              Open Locations
            </Link>
          }
        />
      </>
    )
  }

  return (
    <>
      <Link href={inventoryHubHref('receive-stock')} className="back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        Receive stock
      </Link>

      <PageHeader
        eyebrow={<LocationEyebrow label="Receiving at" name={warehouseName} />}
        title={styleCode ? `Receive stock · ${styleCode}` : 'Receive stock'}
        description={
          styleCode
            ? 'Every variant of this model is listed below. Enter quantities for what arrived, and the price the supplier charged per piece.'
            : 'Record a supplier delivery: what arrived, from whom, on which invoice, and what it cost per piece.'
        }
      />

      <form className="split receive-stock-form" onSubmit={submit}>
        <div className="panel receive-stock-main">
          <Section
            number={1}
            title="The invoice"
            hint="Photograph the supplier's paperwork. Everything below is copied off it."
          >
            <ReceiptPhotoField photo={photo} onChange={setPhoto} />
          </Section>

          <Section number={2} title="The document" hint="What is written on the supplier's invoice.">
            <p className="field-hint">
              The receipt number is issued by the server when you post this, as <span className="tabular">GR-00000001</span>.
              You do not type it.
            </p>
            <Field label="Supplier" hint="Who sent it. Required." className="full">
              <div className="stack gap-sm">
                <SupplierPicker value={supplier} onChange={setSupplier} />
              </div>
            </Field>
            <div className="form-grid">
              <Field
                label="Their invoice number"
                hint="Optional. When you give one, the same number from the same supplier is refused as a duplicate."
              >
                <input
                  className="tabular"
                  value={supplierInvoiceNumber}
                  onChange={(event) => setSupplierInvoiceNumber(event.target.value)}
                  placeholder="INV-2026-114"
                  autoComplete="off"
                />
              </Field>
              <Field label="Date on the invoice" hint="Not always today.">
                <input
                  type="date"
                  className="tabular"
                  value={invoiceDate}
                  onChange={(event) => setInvoiceDate(event.target.value)}
                  required
                />
              </Field>
            </div>
            <Field label="Note" hint="Anything worth remembering about this delivery." className="full">
              <textarea
                rows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Two boxes short, supplier sending the rest next week"
              />
            </Field>
          </Section>

          <Section
            number={3}
            title="What arrived"
            hint={
              styleCode
                ? `Variants of ${styleCode}. Leave blank any size or colour that did not ship.`
                : 'Search the catalog, then enter pieces received and the price per piece.'
            }
          >
            {styleCode && catalog.data === undefined ? (
              <p className="muted">Loading variants for {styleCode}…</p>
            ) : styleCode && lines.length === 0 ? (
              <p className="muted">No variants found for {styleCode}. Search below to add items manually.</p>
            ) : null}
            <ReceiptLinePicker
              branchId={warehouseId ?? ''}
              lines={lines}
              onChange={setLines}
              showCosts={showCosts}
            />
          </Section>

          <Section number={4} title="What happens when you post" hint="So nobody has to guess what is shared.">
            <ul className="section-note-list receive-stock-notes">
              <li>
                <strong>On the server:</strong> the whole document. supplier, their invoice number and date, every
                line with its quantity and unit cost, and the total it works out. The warehouse stock grows in the same
                transaction, and it is written to the ledger and the audit log. Every device sees it.
              </li>
              <li>
                <strong>On this device only:</strong> the photograph. The API has no field for one, so the picture of
                the paper stays in this browser while all the numbers on it are shared.
              </li>
              <li>
                A posted receipt <strong>cannot be edited or deleted</strong>. A mistake is corrected with a stock
                adjustment, which keeps both the original and the correction in the record.
              </li>
            </ul>
          </Section>
        </div>

        <aside className="split-aside">
          <ReceiveReceiptSummary
            supplierName={supplier?.name ?? ''}
            reference={supplierInvoiceNumber}
            styleCode={styleCode}
            branchName={warehouseName}
            lineCount={lines.length}
            filledLines={filled}
            units={units}
            totalValue={totalValue}
            showCosts={showCosts}
            problem={problem}
            pending={post.isPending}
          />
        </aside>
      </form>
    </>
  )
}
