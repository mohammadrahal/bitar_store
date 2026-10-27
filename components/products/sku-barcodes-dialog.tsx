'use client'

import { useId, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Wand2, X } from 'lucide-react'
import { useAddBarcode, useGenerateBarcode, useRemoveBarcode } from '@/hooks/use-skus'
import { useModalBehavior } from '@/hooks/use-modal-behavior'
import { formatBarcode } from '@/lib/barcode'
import { barcodeSchema, type BarcodeFormValues } from '@/schemas/product.schema'
import type { Barcode, Variant } from '@/types'

/** Every barcode that scans to this SKU: the label's own and any supplier codes. */
export function SkuBarcodesDialog({ variant, barcodes, onClose }: { variant: Variant; barcodes: Barcode[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const fieldId = useId()
  const add = useAddBarcode()
  const remove = useRemoveBarcode()
  const generate = useGenerateBarcode()
  useModalBehavior(ref, onClose)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BarcodeFormValues>({ resolver: zodResolver(barcodeSchema), defaultValues: { code: '' } })

  const submit = handleSubmit(({ code }) => {
    add.mutate({ variantId: variant.id, code }, { onSuccess: () => reset() })
  })
  const fieldError = errors.code?.message ?? add.error?.message

  return (
    <div className="overlay overlay-center">
      <div className="overlay-backdrop" onClick={onClose} aria-hidden="true" />
      <div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>Barcodes for {variant.sku}</h2>
        <p>Any of these scans to {variant.color} / {variant.size}. A barcode can belong to one SKU only.</p>

        {barcodes.length === 0 ? (
          <div className="barcode-empty">
            <p className="subtitle">No barcode yet. Generate a store barcode, or scan a supplier label below.</p>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={generate.isPending}
              onClick={() => generate.mutate({ variantId: variant.id })}
            >
              <Wand2 size={16} aria-hidden="true" />
              {generate.isPending ? 'Generating…' : 'Generate barcode'}
            </button>
          </div>
        ) : (
          <ul className="history-list">
            {barcodes.map((barcode) => (
              <li key={barcode.id}>
                <span className="tabular">{formatBarcode(barcode.code)}</span>
                <button
                  type="button"
                  className="icon-btn"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate({ barcodeId: barcode.id, code: barcode.code })}
                  aria-label={`Remove barcode ${barcode.code}`}
                  title="Remove"
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form className="dialog-form" noValidate onSubmit={submit}>
          <div className="field">
            <label htmlFor={fieldId}>Add a supplier barcode</label>
            <input
              id={fieldId}
              {...register('code', { onChange: () => add.reset() })}
              autoComplete="off"
              spellCheck={false}
              placeholder="Scan or type"
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? `${fieldId}-error` : undefined}
              data-autofocus
            />
            {fieldError && <span id={`${fieldId}-error`} className="field-error">{fieldError}</span>}
          </div>
          <div className="dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Done
            </button>
            <button type="submit" className="btn btn-primary" disabled={add.isPending}>
              {add.isPending ? 'Adding…' : 'Add barcode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
