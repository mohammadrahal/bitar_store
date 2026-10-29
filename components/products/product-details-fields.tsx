'use client'

import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { Field } from '@/components/shared/field'
import { useCategories } from '@/hooks/use-products'
import type { ProductDetailsFormValues } from '@/schemas/product.schema'

/**
 * Name, category, sell price and the optional details, shared by the new-model
 * page and the edit drawer. There is no cost field: cost is recorded on each
 * supplier receipt line, so a model never carries one.
 */
export function ProductDetailsFields({
  register,
  errors,
  priceHint,
}: {
  register: UseFormRegister<ProductDetailsFormValues>
  errors: FieldErrors<ProductDetailsFormValues>
  priceHint?: string
}) {
  const { data: categories } = useCategories()

  return (
    <>
      <div className="form-grid">
        <Field label="Model name" error={errors.name?.message} className="full">
          <input {...register('name')} autoComplete="off" placeholder="Everyday Dress" />
        </Field>
        <Field label="Category" error={errors.category?.message} className="full" hint="Pick an existing one or type a new one">
          <input {...register('category')} autoComplete="off" list="product-categories" placeholder="Dresses" />
        </Field>
        <datalist id="product-categories">
          {categories?.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
        <Field label="Sell price" error={errors.sellPrice?.message} hint={priceHint} className="full">
          <input {...register('sellPrice', { valueAsNumber: true })} type="number" min="0" step="0.01" inputMode="decimal" />
        </Field>
      </div>

      <details className="optional">
        <summary>More details (optional)</summary>
        <div className="form-grid">
          <Field label="Season" error={errors.season?.message}>
            <input {...register('season')} autoComplete="off" placeholder="SS26" />
          </Field>
          <Field label="Brand" error={errors.brand?.message}>
            <input {...register('brand')} autoComplete="off" placeholder="Bitar" />
          </Field>
          <Field label="Material" error={errors.material?.message} className="full">
            <input {...register('material')} autoComplete="off" placeholder="100% linen" />
          </Field>
          <Field label="Description" error={errors.description?.message} className="full">
            <textarea {...register('description')} rows={3} />
          </Field>
        </div>
      </details>
    </>
  )
}
