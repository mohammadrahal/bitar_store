'use client'

import { Controller, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'
import { CategoryPicker } from '@/components/products/category-picker'
import { Field } from '@/components/shared/field'
import type { ProductDetailsFormValues } from '@/schemas/product.schema'

/**
 * Name, category, cost and sell price. shared by the new-model page and the edit drawer.
 */
export function ProductDetailsFields({
  register,
  control,
  errors,
  priceHint,
  costHint,
  showCost = false,
}: {
  register: UseFormRegister<ProductDetailsFormValues>
  control: Control<ProductDetailsFormValues>
  errors: FieldErrors<ProductDetailsFormValues>
  priceHint?: string
  costHint?: string
  /** Hidden for staff who must not see cost (`canViewCosts` from `GET /auth/me`). */
  showCost?: boolean
}) {

  return (
    <>
      <div className="form-grid">
        <Field label="Model name" error={errors.name?.message} className="full">
          <input {...register('name')} autoComplete="off" placeholder="Everyday Dress" />
        </Field>
        <fieldset className="field full">
          <legend>Category</legend>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <CategoryPicker value={field.value} onChange={field.onChange} error={errors.category?.message} />
            )}
          />
        </fieldset>
        {showCost ? (
          <Field label="Unit cost" error={errors.unitCost?.message} hint={costHint}>
            <input {...register('unitCost', { valueAsNumber: true })} type="number" min="0" step="0.01" inputMode="decimal" />
          </Field>
        ) : null}
        <Field label="Sell price" error={errors.sellPrice?.message} hint={priceHint} className={showCost ? undefined : 'full'}>
          <input {...register('sellPrice', { valueAsNumber: true })} type="number" min="0" step="0.01" inputMode="decimal" />
        </Field>
      </div>
    </>
  )
}
