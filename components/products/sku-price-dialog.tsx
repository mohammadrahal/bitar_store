'use client'

import { useId, useRef } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MoneyInput } from '@/components/shared/money-input'
import { usePriceHistory, useUpdateVariant } from '@/hooks/use-skus'
import { useModalBehavior } from '@/hooks/use-modal-behavior'
import { formatDocumentDate, formatPrice } from '@/lib/format'
import { skuEditSchema, type SkuEditFormValues } from '@/schemas/product.schema'
import type { Variant } from '@/types'

function PriceHistory({ variantId }: { variantId: string }) {
  const { data, isPending, isError } = usePriceHistory(variantId)
  if (isPending) return <p className="subtitle">Loading price history…</p>
  if (isError) return <p className="field-error">Could not load the price history.</p>
  if (data.length === 0) return <p className="subtitle">No price changes yet.</p>
  return (
    <ul className="history-list">
      {data.map((change) => (
        <li key={change.id}>
          <span className="tabular">
            {change.oldPrice === null ? 'Set to' : `${formatPrice(change.oldPrice)} →`} {formatPrice(change.newPrice)}
          </span>
          <small>{formatDocumentDate(change.effectiveAt)}</small>
        </li>
      ))}
    </ul>
  )
}

/**
 * Edits one SKU: its color, size and price. The price goes through its own
 * endpoint so the API records it, listed underneath; the SKU code never changes.
 */
export function SkuEditDialog({ variant, onClose }: { variant: Variant; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const colorId = useId()
  const sizeId = useId()
  const priceId = useId()
  const update = useUpdateVariant()
  useModalBehavior(ref, onClose)
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<SkuEditFormValues>({
    resolver: zodResolver(skuEditSchema),
    defaultValues: { color: variant.color, size: variant.size, price: variant.sellPrice },
  })

  const submit = handleSubmit((values) => {
    if (!isDirty) return onClose()
    update.mutate({ variant, values, sku: variant.sku }, { onSuccess: onClose })
  })

  return (
    <div className="overlay overlay-center">
      <div className="overlay-backdrop" onClick={onClose} aria-hidden="true" />
      <div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>Edit {variant.sku}</h2>
        <p>
          The SKU code and barcodes stay the same. A new price applies from now on; past sales keep the price they were
          made at.
        </p>
        <form className="dialog-form" noValidate onSubmit={submit}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor={colorId}>Color</label>
              <input
                id={colorId}
                {...register('color')}
                autoComplete="off"
                aria-invalid={errors.color ? true : undefined}
                aria-describedby={errors.color ? `${colorId}-error` : undefined}
                data-autofocus
              />
              {errors.color && <span id={`${colorId}-error`} className="field-error">{errors.color.message}</span>}
            </div>
            <div className="field">
              <label htmlFor={sizeId}>Size</label>
              <input
                id={sizeId}
                {...register('size')}
                autoComplete="off"
                aria-invalid={errors.size ? true : undefined}
                aria-describedby={errors.size ? `${sizeId}-error` : undefined}
              />
              {errors.size && <span id={`${sizeId}-error`} className="field-error">{errors.size.message}</span>}
            </div>
          </div>
          <div className="field">
            <label htmlFor={priceId}>Sell price ({variant.currency})</label>
            <Controller
              control={control}
              name="price"
              render={({ field }) => (
                <MoneyInput
                  id={priceId}
                  ref={field.ref}
                  name={field.name}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={(next) => field.onChange(next ?? Number.NaN)}
                  aria-invalid={errors.price ? true : undefined}
                  aria-describedby={errors.price ? `${priceId}-error` : undefined}
                />
              )}
            />
            {errors.price && <span id={`${priceId}-error`} className="field-error">{errors.price.message}</span>}
          </div>
          <div className="dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={update.isPending}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={update.isPending}>
              {update.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
        <h3 className="dialog-subtitle">Price history</h3>
        <PriceHistory variantId={variant.id} />
      </div>
    </div>
  )
}
