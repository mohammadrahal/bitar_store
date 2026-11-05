'use client'

import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ProductDetailsFields } from '@/components/products/product-details-fields'
import { Drawer } from '@/components/shared/drawer'
import { useUpdateProduct } from '@/hooks/use-products'
import { productDetailsSchema, type ProductDetailsFormValues } from '@/schemas/product.schema'
import { useCurrentUser } from '@/store/user-store'
import type { ProductWithVariants } from '@/types'

function toFormValues(product: ProductWithVariants): ProductDetailsFormValues {
  return {
    name: product.name,
    category: product.category,
    unitCost: product.unitCost ?? 0,
    sellPrice: product.sellPrice,
  }
}

/** Edits a model's details. The code and existing variants never change. */
export function ProductForm({ product, onClose }: { product: ProductWithVariants; onClose: () => void }) {
  const update = useUpdateProduct()
  const showCost = useCurrentUser().canViewCosts
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ProductDetailsFormValues>({
    resolver: zodResolver(productDetailsSchema),
    defaultValues: toFormValues(product),
  })

  const submit = handleSubmit((values) =>
    update.mutate({ productId: product.id, input: values }, { onSuccess: onClose }),
  )

  return (
    <Drawer
      eyebrow={product.code}
      title="Edit model"
      description="The style code and SKU codes stay as they are. Add new colors or sizes from the model page."
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={update.isPending}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <ProductDetailsFields
        register={register}
        control={control}
        errors={errors}
        showCost={showCost}
        costHint="What you pay the supplier. Saved on this device until the catalog API stores cost."
        priceHint="A new price applies to every active SKU. To price one SKU, use its row on the model page."
      />
    </Drawer>
  )
}
