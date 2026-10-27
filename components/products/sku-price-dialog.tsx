'use client'

import { useId, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { usePriceHistory, useSetVariantPrice } from '@/hooks/use-skus'
import { useModalBehavior } from '@/hooks/use-modal-behavior'
import { formatDocumentDate, formatPrice } from '@/lib/format'
import { skuPriceSchema, type SkuPriceFormValues } from '@/schemas/product.schema'
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

/** Sets one SKU's price. The API records every change, listed underneath. */
export function SkuPriceDialog({ variant, onClose }: { variant: Variant; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const fieldId = useId()
  const setPrice = useSetVariantPrice()
  useModalBehavior(ref, onClose)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SkuPriceFormValues>({ resolver: zodResolver(skuPriceSchema), defaultValues: { price: variant.sellPrice } })

  const submit = handleSubmit(({ price }) => {
    if (price === variant.sellPrice) return onClose()
    setPrice.mutate({ variantId: variant.id, price, sku: variant.sku }, { onSuccess: onClose })
  })

  return (
    <div className="overlay overlay-center">
      <div className="overlay-backdrop" onClick={onClose} aria-hidden="true" />
      <div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>Price of {variant.sku}</h2>
        <p>
          {variant.color} / {variant.size}. A new price applies from now on; past sales keep the price they were made at.
        </p>
        <form className="dialog-form" noValidate onSubmit={submit}>
          <div className="field">
            <label htmlFor={fieldId}>Price ({variant.currency})</label>
            <input
              id={fieldId}
              {...register('price', { valueAsNumber: true })}
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              aria-invalid={errors.price ? true : undefined}
              aria-describedby={errors.price ? `${fieldId}-error` : undefined}
              data-autofocus
            />
            {errors.price && <span id={`${fieldId}-error`} className="field-error">{errors.price.message}</span>}
          </div>
          <div className="dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={setPrice.isPending}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={setPrice.isPending}>
              {setPrice.isPending ? 'Saving…' : 'Save price'}
            </button>
          </div>
        </form>
        <h3 className="dialog-subtitle">Price history</h3>
        <PriceHistory variantId={variant.id} />
      </div>
    </div>
  )
}
