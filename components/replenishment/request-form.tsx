'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { CatalogVariantPicker } from '@/components/shared/catalog-variant-picker'
import { Drawer } from '@/components/shared/drawer'
import { Field } from '@/components/shared/field'
import { LocationSelect } from '@/components/shared/location-select'
import { useCreateReplenishmentRequest } from '@/hooks/use-replenishment-requests'
import { usePermission } from '@/hooks/use-permission'
import type { VariantOption } from '@/types'

interface Line {
  option: VariantOption
  quantity: number
}

/** A branch asking the warehouse for stock: variants, quantities and a reason (BL-05). */
export function ReplenishmentRequestForm({
  defaultBranchId,
  onClose,
}: {
  defaultBranchId: string
  onClose: () => void
}) {
  const { locationScoped } = usePermission()
  const create = useCreateReplenishmentRequest()
  const [branchChoice, setBranchChoice] = useState(defaultBranchId)
  const [lines, setLines] = useState<Line[]>([])
  const [reason, setReason] = useState('')

  const branchId = locationScoped ? defaultBranchId : branchChoice
  const add = (option: VariantOption) => setLines((current) => [...current, { option, quantity: 1 }])
  const total = lines.reduce((sum, line) => sum + line.quantity, 0)

  const submit = () =>
    create.mutate(
      {
        branchId,
        reason,
        lines: lines.map((line) => ({ variantId: line.option.variantId, quantity: line.quantity })),
      },
      { onSuccess: onClose },
    )

  return (
    <Drawer
      eyebrow="Replenishment"
      title="Request stock"
      description="Ask for what this location needs. A super admin or manager approves all of it, part of it, or rejects it with a reason."
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={create.isPending}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={create.isPending || lines.length === 0 || !branchId || reason.trim() === ''}
          >
            {create.isPending ? 'Sending…' : `Send request (${total})`}
          </button>
        </>
      }
    >
      <div className="form-grid">
        {!locationScoped && (
          <Field label="For location" className="full">
            <LocationSelect
              value={branchChoice}
              onChange={setBranchChoice}
              onlyAccessible
              onlyFullAccess
              placeholder="Select"
            />
          </Field>
        )}

        <Field label="Why is it needed?" className="full" hint="Shown to whoever reviews the request">
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            autoComplete="off"
            placeholder="Running low on best sellers before the weekend"
          />
        </Field>

        <div className="full stack">
          <CatalogVariantPicker excluded={lines.map((line) => line.option.variantId)} onPick={add} />
        </div>

        {lines.length > 0 && (
          <ul className="sale-lines full" aria-label="Requested variants">
            {lines.map((line) => (
              <li key={line.option.variantId}>
                <span>
                  {line.option.productName} {line.option.color} / {line.option.size}
                </span>
                <span className="row-actions">
                  <input
                    className="qty-input tabular"
                    type="number"
                    min={1}
                    step={1}
                    value={line.quantity}
                    aria-label={`Quantity of ${line.option.sku}`}
                    onChange={(event) => {
                      const parsed = Math.floor(Number(event.target.value))
                      setLines((current) =>
                        current.map((entry) =>
                          entry === line ? { ...entry, quantity: Number.isFinite(parsed) ? Math.max(1, parsed) : 1 } : entry,
                        ),
                      )
                    }}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Remove ${line.option.sku}`}
                    onClick={() => setLines((current) => current.filter((entry) => entry !== line))}
                  >
                    <Trash2 size={16} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Drawer>
  )
}
