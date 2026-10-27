'use client'

import { useState } from 'react'
import { QuantityInput } from '@/components/shared/quantity-input'
import { ReasonDialog } from '@/components/shared/reason-dialog'
import { VariantPicker } from '@/components/shared/variant-picker'
import type { VariantOption } from '@/types'

/** Pick a variant at the location, a quantity up to what is available, and a reason. Used for holds and disposals. */
export function VariantQuantityDialog({
  branchId,
  title,
  description,
  confirmLabel,
  tone,
  pending,
  onConfirm,
  onCancel,
}: {
  branchId: string
  title: string
  description: string
  confirmLabel: string
  tone: 'danger' | 'default'
  pending: boolean
  onConfirm: (input: { variantId: string; quantity: number; reason: string }) => void
  onCancel: () => void
}) {
  const [option, setOption] = useState<VariantOption | null>(null)
  const [quantity, setQuantity] = useState(1)

  return (
    <ReasonDialog
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      tone={tone}
      pending={pending}
      onCancel={onCancel}
      onConfirm={(reason) => option && quantity > 0 && onConfirm({ variantId: option.variantId, quantity, reason })}
    >
      {option ? (
        <div className="sale-lines stacked">
          <div className="sale-card-head">
            <span>
              <strong>
                {option.productName} {option.color} / {option.size}
              </strong>
              <small className="tabular">{option.sku}</small>
            </span>
            <button type="button" className="text-btn" onClick={() => setOption(null)}>
              Change
            </button>
          </div>
          <QuantityInput
            value={quantity}
            min={1}
            max={option.available ?? 0}
            onChange={setQuantity}
            label={`Quantity of ${option.color} / ${option.size}`}
          />
        </div>
      ) : (
        <VariantPicker
          branchId={branchId}
          excluded={[]}
          onPick={(picked) => {
            setOption(picked)
            setQuantity(1)
          }}
        />
      )}
    </ReasonDialog>
  )
}
