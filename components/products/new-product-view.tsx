'use client'

import Link from 'next/link'

import { useRouter } from 'next/navigation'
import { useForm, useWatch, type Control, type UseFormRegister } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { VariantPricesTable } from '@/components/products/variant-prices-table'
import { ColorPicker } from '@/components/products/color-picker'
import { NewProductSummary } from '@/components/products/new-product-summary'
import { Section } from '@/components/products/form-section'

import { ProductDetailsFields } from '@/components/products/product-details-fields'
import { SizePicker } from '@/components/products/size-picker'
import { Field } from '@/components/shared/field'

import { VariantGrid } from '@/components/products/variant-grid'
import { VariantOpeningQuantities } from '@/components/products/variant-opening-quantities'
import { Can } from '@/components/shared/can'
import { LocationSelect } from '@/components/shared/location-select'
import { PageHeader } from '@/components/shared/page-header'

import { useCreateProduct } from '@/hooks/use-products'
import { useCurrentUser } from '@/store/user-store'
import {
  combinationsOf,
  comboKey,
  emptyNewProductValues,
  newProductSchema,
  type NewProductFormValues,
  type ProductDetailsFormValues,
} from '@/schemas/product.schema'

export function NewProductView() {
  const router = useRouter()
  const create = useCreateProduct()
  const showCost = useCurrentUser().canViewCosts

  const { register, handleSubmit, control, setValue, formState: { errors, isSubmitted } } = useForm<NewProductFormValues>({
    resolver: zodResolver(newProductSchema),
    defaultValues: emptyNewProductValues,
  })
  const values = useWatch({ control })
  const colors = values.colors ?? []
  const sizes = values.sizes ?? []
  const excluded = values.excluded ?? []
  const combos = combinationsOf({ colors, sizes, excluded })
  const revalidate = { shouldValidate: isSubmitted }

  const submit = handleSubmit((form) => {
    const { code, name, category, unitCost, sellPrice } = form
    create.mutate(
      {
        code,
        name,
        category,
        unitCost: showCost ? unitCost : 0,
        sellPrice,
        costs: showCost ? form.costs : {},
        variants: combinationsOf(form).map(({ color, size }) => ({
          color,
          size,
          sellPrice: form.prices[comboKey(color, size)] ?? form.sellPrice,
        })),
        initialBranchId: form.initialBranchId?.trim() || undefined,
        openingQuantities: form.openingQuantities,
      },
      { onSuccess: ({ product }) => router.push(`/products/${product.id}?created=1`) },
    )
  })

  const pricesError = typeof errors.prices?.message === 'string' ? errors.prices.message : undefined
  const firstError = [errors.code, errors.name, errors.category, errors.unitCost, errors.sellPrice, errors.colors, errors.sizes, errors.excluded]
    .find(Boolean)?.message ?? pricesError

  return (
    <>
      <Link href="/products" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        Products
      </Link>
      <PageHeader eyebrow="Catalog" title="New model" description="Describe the model once, then pick its colors and sizes." />
      <form className="split" onSubmit={submit} noValidate>
        <div className="panel">
          <Section number={1} title="Details" hint="Name, category, what you pay and what you charge.">
            <div className="form-grid">
              <Field
                label="Style code"
                error={errors.code?.message}
                className="full"
                hint="Printed on labels and fixed once saved. Leave empty to take the next MD number."
              >
                <input {...register('code')} autoComplete="off" placeholder="MD000124" spellCheck={false} />
              </Field>
            </div>
            <ProductDetailsFields
              register={register as unknown as UseFormRegister<ProductDetailsFormValues>}
              control={control as unknown as Control<ProductDetailsFormValues>}
              errors={errors}
              showCost={showCost}
              costHint="What you pay the supplier. Saved on this device until the catalog API stores cost."
              priceHint="The default for every variant. Override a single one under Prices."
            />
          </Section>
          <Section number={2} title="Colors" hint="Pick from the shared list or add a new one." error={errors.colors?.message}>
            <ColorPicker value={colors} onChange={(next) => setValue('colors', next, revalidate)} />
          </Section>
          <Section number={3} title="Sizes" hint="Switch lists without losing what you already picked. Use Custom for a size that is not in the list." error={errors.sizes?.message}>
            <SizePicker
              system={values.sizeSystem ?? 'letter'}
              sizes={sizes}
              onSystemChange={(next) => setValue('sizeSystem', next, revalidate)}
              onChange={(next) => setValue('sizes', next, revalidate)}
            />
          </Section>
          <Section number={4} title="Variants" hint="Untick any combination you will not stock." error={errors.excluded?.message}>
            <VariantGrid
              colors={colors}
              sizes={sizes}
              isOn={(color, size) => !excluded.includes(comboKey(color, size))}
              onToggle={(color, size) => {
                const key = comboKey(color, size)
                const next = excluded.includes(key) ? excluded.filter((entry) => entry !== key) : [...excluded, key]
                setValue('excluded', next, revalidate)
              }}
            />
          </Section>
          <Can permission="opening_stock.post">
            <Section
              number={5}
              title="First stock (optional)"
              hint="Choose one location and enter units. Other branches stay at zero — the catalog never copies stock everywhere."
              error={errors.initialBranchId?.message}
            >
              <Field label="Location" error={errors.initialBranchId?.message}>
                <LocationSelect
                  value={values.initialBranchId ?? ''}
                  onChange={(next) => setValue('initialBranchId', next, revalidate)}
                  onlyAccessible
                  onlyFullAccess
                  placeholder="None — save without placing stock"
                />
              </Field>
              <VariantOpeningQuantities
                combos={combos}
                quantities={(values.openingQuantities ?? {}) as Record<string, number>}
                onChange={(next) => setValue('openingQuantities', next, revalidate)}
              />
            </Section>
          </Can>
          <Section
            number={6}
            title="Prices"
            hint={showCost ? 'Override sell price or unit cost for any variant.' : 'Override any variant that does not sell for the model price.'}
            error={isSubmitted ? pricesError : undefined}
          >
            <VariantPricesTable
              combos={combos}
              prices={(values.prices ?? {}) as Record<string, number>}
              costs={showCost ? ((values.costs ?? {}) as Record<string, number>) : undefined}
              defaultPrice={values.sellPrice ?? 0}
              defaultCost={showCost ? (values.unitCost ?? 0) : undefined}
              onPriceChange={(next) => setValue('prices', next, revalidate)}
              onCostChange={showCost ? (next) => setValue('costs', next, revalidate) : undefined}
            />
          </Section>

        </div>
        <aside className="split-aside">
          <NewProductSummary
            name={values.name ?? ''}
            combos={combos}
            unitCost={showCost ? (values.unitCost ?? 0) : undefined}
            sellPrice={values.sellPrice ?? 0}
            prices={(values.prices ?? {}) as Record<string, number>}
            pending={create.isPending}
            error={isSubmitted ? firstError : undefined}
          />
        </aside>
      </form>
    </>
  )
}
