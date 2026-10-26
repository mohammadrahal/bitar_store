'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useFieldArray, type Control, type FieldErrors, type UseFormRegister, type UseFormWatch } from 'react-hook-form'
import { Field } from '@/components/shared/field'
import { formatBarcode } from '@/lib/barcode'
import { buildSku } from '@/lib/sku'
import type { ProductFormValues } from '@/schemas/product.schema'

export function VariantFields({
  control,
  register,
  watch,
  errors,
}: {
  control: Control<ProductFormValues>
  register: UseFormRegister<ProductFormValues>
  watch: UseFormWatch<ProductFormValues>
  errors: FieldErrors<ProductFormValues>
}) {
  const { fields, append, remove } = useFieldArray({ control, name: 'variants' })
  const productName = watch('name')
  const variants = watch('variants')

  return (
    <div className="drawer-section">
      <div className="variant-heading">
        <div>
          <p className="section-label">Variants</p>
          <p className="field-hint">SKUs come from the product name, size and color. Barcodes are in-store EAN-13, assigned on save.</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => append({ size: '', color: '' })}>
          <Plus size={14} aria-hidden="true" />
          Add variant
        </button>
      </div>

      {errors.variants?.root?.message && <span className="field-error">{errors.variants.root.message}</span>}
      {typeof errors.variants?.message === 'string' && <span className="field-error">{errors.variants.message}</span>}

      <ul className="variant-rows">
        {fields.map((field, index) => {
          const size = variants?.[index]?.size ?? ''
          const color = variants?.[index]?.color ?? ''
          const sku = size && color && productName ? buildSku(productName, size, color) : null
          const barcode = variants?.[index]?.barcode ?? ''

          return (
            <li key={field.id} className="variant-row">
              <Field label="Size" error={errors.variants?.[index]?.size?.message}>
                <input {...register(`variants.${index}.size`)} autoComplete="off" placeholder="M" />
              </Field>
              <Field label="Color" error={errors.variants?.[index]?.color?.message}>
                <input {...register(`variants.${index}.color`)} autoComplete="off" placeholder="White" />
              </Field>
              <button
                type="button"
                className="icon-btn danger"
                onClick={() => remove(index)}
                disabled={fields.length === 1}
                aria-label={`Remove variant ${index + 1}`}
                title={fields.length === 1 ? 'A product needs at least one variant' : 'Remove variant'}
              >
                <Trash2 size={16} />
              </button>
              <p className="variant-sku">
                SKU
                <strong>{sku ?? '—'}</strong>
                <span aria-hidden="true">·</span>
                Barcode
                {/* Minted by the service on save, so a new row has none yet. */}
                <strong>{barcode ? formatBarcode(barcode) : 'on save'}</strong>
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
