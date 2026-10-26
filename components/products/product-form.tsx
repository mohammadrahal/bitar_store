'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { VariantFields } from '@/components/products/variant-fields'
import { Drawer } from '@/components/shared/drawer'
import { Field } from '@/components/shared/field'
import { usePermission } from '@/hooks/use-permission'
import { useCategories, useCreateProduct, useUpdateProduct } from '@/hooks/use-products'
import { emptyProductValues, productSchema, type ProductFormValues } from '@/schemas/product.schema'
import type { ProductWithVariants } from '@/types'

function toFormValues(product?: ProductWithVariants): ProductFormValues {
  if (!product) return emptyProductValues
  return {
    name: product.name,
    category: product.category,
    costPrice: product.costPrice,
    sellPrice: product.sellPrice,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      barcode: variant.barcode,
      size: variant.size,
      color: variant.color,
    })),
  }
}

/** Used for both create and edit; `product` decides which. */
export function ProductForm({ product, onClose }: { product?: ProductWithVariants; onClose: () => void }) {
  const create = useCreateProduct()
  const update = useUpdateProduct()
  const { data: categories } = useCategories()
  const showCost = usePermission().can('products:read-cost')
  const pending = create.isPending || update.isPending

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: toFormValues(product),
  })

  const submit = handleSubmit((values) => {
    if (product) update.mutate({ productId: product.id, input: values }, { onSuccess: onClose })
    else create.mutate(values, { onSuccess: onClose })
  })

  return (
    <Drawer
      eyebrow="Products"
      title={product ? 'Edit product' : 'New product'}
      description={
        product
          ? 'Removing a variant also removes its stock records in every branch.'
          : 'Variants start at zero stock in every branch.'
      }
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Saving…' : product ? 'Save changes' : 'Create product'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Product name" error={errors.name?.message} className="full">
          <input {...register('name')} autoComplete="off" placeholder="Oxford Shirt" />
        </Field>
        <Field label="Category" error={errors.category?.message} className="full" hint="Pick an existing one or type a new one">
          <input {...register('category')} autoComplete="off" list="product-categories" placeholder="Shirts" />
        </Field>
        <datalist id="product-categories">
          {categories?.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
        {showCost ? (
          <Field label="Cost price" error={errors.costPrice?.message}>
            <input {...register('costPrice', { valueAsNumber: true })} type="number" min="0" step="0.01" inputMode="decimal" />
          </Field>
        ) : (
          /* Registered but hidden: an employee editing a product must not
             reset a cost price they are not allowed to see. */
          <input {...register('costPrice', { valueAsNumber: true })} type="hidden" />
        )}
        <Field
          label="Sell price"
          error={errors.sellPrice?.message}
          className={showCost ? undefined : 'full'}
        >
          <input {...register('sellPrice', { valueAsNumber: true })} type="number" min="0" step="0.01" inputMode="decimal" />
        </Field>
      </div>

      <VariantFields control={control} register={register} watch={watch} errors={errors} />
    </Drawer>
  )
}
