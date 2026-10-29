'use client'

import { useState } from 'react'
import { Paperclip, Trash2 } from 'lucide-react'
import { CatalogVariantPicker } from '@/components/shared/catalog-variant-picker'
import { Drawer } from '@/components/shared/drawer'
import { Field } from '@/components/shared/field'
import { SelectInput } from '@/components/shared/select-input'
import { usePermission } from '@/hooks/use-permission'
import { useCorrectReceipt, useCreateReceipt, useSuppliers, useUpdateReceipt } from '@/hooks/use-receiving'
import { formatPrice } from '@/lib/format'
import type { ReceiptRow, VariantOption } from '@/types'

interface DraftLine {
  variantId: string
  label: string
  sku: string
  quantity: number
  unitCost: number
}

const today = () => new Date().toISOString().slice(0, 10)

function linesOf(receipt: ReceiptRow | undefined): DraftLine[] {
  return (
    receipt?.lines.map((line) => ({
      variantId: line.variantId,
      label: line.label,
      sku: line.sku,
      quantity: line.quantity,
      unitCost: line.unitCost,
    })) ?? []
  )
}

/**
 * A supplier receipt: who it came from, when, the paperwork reference, and the
 * accepted quantity and unit cost per variant (BL-06). Costs need `costs.view`.
 * `mode` is 'correction' when fixing a confirmed receipt, which saves a new
 * linked record with a reason rather than editing the original.
 */
export function ReceiptForm({
  receipt,
  mode = 'draft',
  onClose,
}: {
  receipt?: ReceiptRow
  mode?: 'draft' | 'correction'
  onClose: () => void
}) {
  const { canViewCosts } = usePermission()
  const { data: suppliers } = useSuppliers()
  const create = useCreateReceipt()
  const update = useUpdateReceipt()
  const correct = useCorrectReceipt()

  const [supplierId, setSupplierId] = useState(receipt?.supplierId ?? '')
  const [receivedOn, setReceivedOn] = useState(receipt?.receivedOn ?? today())
  const [invoiceReference, setInvoiceReference] = useState(receipt?.invoiceReference ?? '')
  const [attachmentName, setAttachmentName] = useState(receipt?.attachmentName ?? '')
  const [lines, setLines] = useState<DraftLine[]>(linesOf(receipt))
  const [reason, setReason] = useState('')

  const pending = create.isPending || update.isPending || correct.isPending
  const units = lines.reduce((sum, line) => sum + line.quantity, 0)
  const total = lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0)
  const isCorrection = mode === 'correction'

  const add = (option: VariantOption) =>
    setLines((current) => [
      ...current,
      {
        variantId: option.variantId,
        label: `${option.productName} ${option.color} / ${option.size}`,
        sku: option.sku,
        quantity: 1,
        unitCost: option.costPrice,
      },
    ])

  const setLine = (variantId: string, patch: Partial<DraftLine>) =>
    setLines((current) => current.map((line) => (line.variantId === variantId ? { ...line, ...patch } : line)))

  const submit = () => {
    const payload = {
      supplierId,
      receivedOn,
      invoiceReference,
      attachmentName,
      lines: lines.map((line) => ({
        variantId: line.variantId,
        quantity: line.quantity,
        unitCost: line.unitCost,
      })),
    }
    if (isCorrection && receipt) {
      correct.mutate({ id: receipt.id, ...payload, reason }, { onSuccess: onClose })
      return
    }
    if (receipt) {
      update.mutate({ id: receipt.id, ...payload }, { onSuccess: onClose })
      return
    }
    create.mutate(payload, { onSuccess: onClose })
  }

  return (
    <Drawer
      eyebrow={isCorrection ? `Correcting ${receipt?.number}` : 'Receiving'}
      title={isCorrection ? 'Correct receipt' : receipt ? `Edit ${receipt.number}` : 'New receipt'}
      description="Goods always arrive at the warehouse. A draft changes nothing until a super admin or manager confirms it."
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={pending || lines.length === 0 || !supplierId || (isCorrection && reason.trim() === '')}
          >
            {pending ? 'Saving…' : isCorrection ? 'Save correction' : 'Save draft'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Supplier" className="full">
          <SelectInput
            value={supplierId}
            onValueChange={setSupplierId}
            placeholder="Select a supplier"
            options={(suppliers ?? []).map((supplier) => ({ value: supplier.id, label: supplier.name }))}
          />
        </Field>
        <Field label="Arrived on">
          <input type="date" value={receivedOn} onChange={(event) => setReceivedOn(event.target.value)} />
        </Field>
        <Field label="Invoice reference" hint="Optional">
          <input
            value={invoiceReference}
            onChange={(event) => setInvoiceReference(event.target.value)}
            autoComplete="off"
            placeholder="INV-8821"
          />
        </Field>

        <Field
          label="Invoice photo or PDF"
          className="full"
          hint={
            attachmentName
              ? `${attachmentName} — the file stays on this device until the backend can store it.`
              : 'Optional. Only the file name is kept for now.'
          }
        >
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(event) => setAttachmentName(event.target.files?.[0]?.name ?? '')}
          />
        </Field>

        {isCorrection && (
          <Field label="Why is this being corrected?" className="full">
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              autoComplete="off"
              placeholder="Two boxes were counted twice"
            />
          </Field>
        )}

        <div className="full stack">
          <CatalogVariantPicker excluded={lines.map((line) => line.variantId)} onPick={add} />
        </div>

        {lines.length > 0 && (
          <div className="table-wrap full">
            <table className="card-table">
              <caption className="sr-only">Accepted quantity and unit cost per variant</caption>
              <thead>
                <tr>
                  <th scope="col">Variant</th>
                  <th scope="col" className="num">
                    Accepted
                  </th>
                  {canViewCosts && (
                    <th scope="col" className="num">
                      Unit cost
                    </th>
                  )}
                  <th scope="col">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.variantId}>
                    <td className="card-title" data-label="Variant">
                      {line.label}
                      <small>{line.sku}</small>
                    </td>
                    <td className="num" data-label="Accepted">
                      <input
                        className="qty-input tabular"
                        type="number"
                        min={1}
                        step={1}
                        value={line.quantity}
                        aria-label={`Accepted units of ${line.sku}`}
                        onChange={(event) => {
                          const parsed = Math.floor(Number(event.target.value))
                          setLine(line.variantId, { quantity: Number.isFinite(parsed) ? Math.max(1, parsed) : 1 })
                        }}
                      />
                    </td>
                    {canViewCosts && (
                      <td className="num" data-label="Unit cost">
                        <input
                          className="qty-input tabular"
                          type="number"
                          min={0}
                          step="0.01"
                          inputMode="decimal"
                          value={line.unitCost || ''}
                          aria-label={`Unit cost of ${line.sku}`}
                          onChange={(event) =>
                            setLine(line.variantId, { unitCost: Math.max(0, Number(event.target.value) || 0) })
                          }
                        />
                      </td>
                    )}
                    <td>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Remove ${line.sku}`}
                        onClick={() =>
                          setLines((current) => current.filter((entry) => entry.variantId !== line.variantId))
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="card-title">
                    <Paperclip size={14} aria-hidden="true" /> {units} {units === 1 ? 'unit' : 'units'}
                  </td>
                  <td />
                  {canViewCosts && (
                    <td className="num tabular" data-label="Total">
                      {formatPrice(total)}
                    </td>
                  )}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </Drawer>
  )
}
