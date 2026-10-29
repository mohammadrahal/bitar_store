'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm, useWatch, type UseFormRegister } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { VariantPricesTable } from '@/components/products/variant-prices-table'
import { ColorPicker } from '@/components/products/color-picker'
import { NewProductSummary } from '@/components/products/new-product-summary'
import { ProductDetailsFields } from '@/components/products/product-details-fields'
import { SizePicker } from '@/components/products/size-picker'
import { Field } from '@/components/shared/field'
import { VariantGrid } from '@/components/products/variant-grid'
import { PageHeader } from '@/components/shared/page-header'
import { useCreateProduct } from '@/hooks/use-products'
import {
  combinationsOf,
  comboKey,
  detailsFrom,
  emptyNewProductValues,
  newProductSchema,
  type NewProductFormValues,
  type ProductDetailsFormValues,
} from '@/schemas/product.schema'

function Section({ number, title, hint, error, children }: {
  number: number
  title: string
  hint: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <section className="form-section" aria-labelledby={`section-${number}`}>
      <div className="form-section-head">
        <span className="section-number" aria-hidden="true">{number}</span>
        <div>
          <h2 id={`section-${number}`}>{title}</h2>
          <p>{hint}</p>
        </div>
      </div>
      {children}
      {error && <p className="field-error" role="alert">{error}</p>}
    </section>
  )
}

export function NewProductView() {
  const router = useRouter()
  const create = useCreateProduct()
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
    const { code, name, category, sellPrice, season, brand, material, description } = form
    create.mutate(
      {
        code,
        name,
        category,
        sellPrice,
        details: detailsFrom({ season, brand, material, description }),
        variants: combinationsOf(form).map(({ color, size }) => ({
          color,
          size,
          sellPrice: form.prices[comboKey(color, size)] ?? form.sellPrice,
        })),
      },
      { onSuccess: ({ product }) => router.push(`/products/${product.id}`) },
    )
  })

  const pricesError = typeof errors.prices?.message === 'string' ? errors.prices.message : undefined
  const firstError = [errors.code, errors.name, errors.category, errors.sellPrice, errors.colors, errors.sizes, errors.excluded]
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
          <Section number={1} title="Details" hint="What the model is called and what it sells for.">
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
              errors={errors}
              priceHint="Default for every variant. Override any row under Branches."
            />
          </Section>
          <Section number={2} title="Colors" hint="Pick from the shared list or add a new one." error={errors.colors?.message}>
            <ColorPicker value={colors} onChange={(next) => setValue('colors', next, revalidate)} />
          </Section>
          <Section number={3} title="Sizes" hint="One size system per model." error={errors.sizes?.message}>
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
          <Section
            number={5}
            title="Prices"
            hint="Override any variant that does not sell for the model price. Saving a model never places stock — start it with an opening count or a supplier receipt."
            error={isSubmitted ? pricesError : undefined}
          >
            <VariantPricesTable
              combos={combos}
              prices={(values.prices ?? {}) as Record<string, number>}
              defaultPrice={values.sellPrice ?? 0}
              onPriceChange={(next) => setValue('prices', next, revalidate)}
            />
          </Section>
        </div>
        <aside className="split-aside">
          <NewProductSummary
            name={values.name ?? ''}
            combos={combos}
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
