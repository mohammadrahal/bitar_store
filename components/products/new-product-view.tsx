'use client'

import Link from 'next/link'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
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

import { VariantComboTable } from '@/components/products/variant-combo-table'
import { NewModelMediaPlaceholder } from '@/components/products/new-model-media-placeholder'
import { VariantOpeningQuantities } from '@/components/products/variant-opening-quantities'
import { Can } from '@/components/shared/can'
import { LocationSelect } from '@/components/shared/location-select'
import { PageHeader } from '@/components/shared/page-header'

import { formatPrice } from '@/lib/format'
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

  const { register, handleSubmit, control, setValue, reset, setFocus, formState: { errors, isSubmitted } } = useForm<NewProductFormValues>({
    resolver: zodResolver(newProductSchema),
    defaultValues: emptyNewProductValues,
  })
  /**
   * Where to go once the server has it.
   *
   * Entering a delivery is a run of ten or twenty models, and each one used to
   * end on the product page: back to Products, "Add product", scroll, type.
   * `another` keeps the form open instead, and keeps the fields that repeat
   * across a run. category, the size system, the sizes, the first-stock
   * location. while clearing the ones that identify a single model. Read from
   * a ref rather than state so the click that submits can set it without the
   * extra render that would re-run validation.
   */
  const after = useRef<'open' | 'another'>('open')
  const values = useWatch({ control })
  const colors = values.colors ?? []
  const sizes = values.sizes ?? []
  const excluded = values.excluded ?? []
  const combos = combinationsOf({ colors, sizes, excluded })
  const revalidate = { shouldValidate: isSubmitted }
  const [customizePrices, setCustomizePrices] = useState(false)
  const modelCode = values.code?.trim() ?? ''
  const defaultPrice = values.sellPrice ?? 0
  const defaultCost = values.unitCost ?? 0
  const customPriceCount = combos.filter(
    ({ color, size }) => (values.prices?.[comboKey(color, size)] ?? defaultPrice) !== defaultPrice,
  ).length
  const allCombos = colors.flatMap((color) => sizes.map((size) => ({ color, size })))

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
      {
        onSuccess: ({ product }) => {
          if (after.current !== 'another') {
            router.push(`/products/${product.id}?created=1`)
            return
          }
          toast.success(`${product.code ?? form.name} saved. Category, sizes and location kept for the next one.`, {
            action: { label: 'Open it', onClick: () => router.push(`/products/${product.id}?created=1`) },
          })
          reset({
            ...emptyNewProductValues,
            category: form.category,
            sizeSystem: form.sizeSystem,
            sizes: form.sizes,
            initialBranchId: form.initialBranchId,
          })
          after.current = 'open'
          /* The dashboard scrolls `main`, not the document. */
          document.getElementById('main')?.scrollTo({ top: 0, behavior: 'smooth' })
          setFocus('name')
        },
        onError: () => {
          /* Nothing was saved, so the next press is a fresh decision. */
          after.current = 'open'
        },
      },
    )
  }, () => {
    /* Invalid form: drop the intent so a later plain Create still navigates. */
    after.current = 'open'
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
      <form className="split split--new-model" onSubmit={submit} noValidate>
        <div className="panel new-model-panel">
          <Section number={1} title="Details" hint="Style code, name, category, and default prices for every variant.">
            <div className="form-grid">
              <Field
                label="Style code"
                error={errors.code?.message}
                hint="Fixed once saved. Leave blank for the next MD number."
              >
                <input {...register('code')} autoComplete="off" placeholder="MD000124" spellCheck={false} className="tabular" />
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
          <Section number={2} title="Media & imagery" hint="Hero shots and swatch references (when the API supports uploads).">
            <NewModelMediaPlaceholder />
          </Section>
          <Section number={3} title="Colors" hint="Add each colour this model is offered in." error={errors.colors?.message}>
            <ColorPicker value={colors} onChange={(next) => setValue('colors', next, revalidate)} />
          </Section>
          <Section number={4} title="Sizes" hint="Letter, numeric, or one size — switch without losing picks. Custom sizes are allowed." error={errors.sizes?.message}>
            <SizePicker
              system={values.sizeSystem ?? 'letter'}
              sizes={sizes}
              onSystemChange={(next) => setValue('sizeSystem', next, revalidate)}
              onChange={(next) => setValue('sizes', next, revalidate)}
            />
          </Section>
          <Section number={5} title="Variants" hint="Generated from colours and sizes. Untick any combination you will not stock." error={errors.excluded?.message}>
            <VariantComboTable
              combos={allCombos}
              modelCode={modelCode}
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
              number={6}
              title="First stock (optional)"
              hint="Choose one location and enter units. Other branches stay at zero. The catalog never copies stock everywhere."
              error={errors.initialBranchId?.message}
            >
              <Field label="Location" error={errors.initialBranchId?.message}>
                <LocationSelect
                  value={values.initialBranchId ?? ''}
                  onChange={(next) => setValue('initialBranchId', next, revalidate)}
                  onlyAccessible
                  onlyFullAccess
                  placeholder="None. Save without placing stock"
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
            number={7}
            title="Prices"
            hint="Default cost and sell price apply to every active variant unless you customize."
            error={isSubmitted ? pricesError : undefined}
          >
            <p className="new-model-prices-summary muted">
              {combos.length === 0 ? (
                'Add colours and sizes to set prices.'
              ) : showCost ? (
                <>
                  Using default prices: cost <span className="tabular">{formatPrice(defaultCost)}</span>
                  {' · '}
                  sell <span className="tabular new-model-prices-summary-sell">{formatPrice(defaultPrice)}</span> for all{' '}
                  {combos.length} {combos.length === 1 ? 'variant' : 'variants'}.
                  {customPriceCount > 0 ? ` ${customPriceCount} customized.` : ''}
                </>
              ) : (
                <>
                  Using default sell price{' '}
                  <span className="tabular new-model-prices-summary-sell">{formatPrice(defaultPrice)}</span> for all{' '}
                  {combos.length} {combos.length === 1 ? 'variant' : 'variants'}.
                  {customPriceCount > 0 ? ` ${customPriceCount} customized.` : ''}
                </>
              )}
            </p>
            {!customizePrices ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm new-model-prices-toggle"
                disabled={combos.length === 0}
                onClick={() => setCustomizePrices(true)}
              >
                Customize individual prices
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCustomizePrices(false)}>
                  Use defaults only
                </button>
                <VariantPricesTable
                  combos={combos}
                  prices={(values.prices ?? {}) as Record<string, number>}
                  costs={showCost ? ((values.costs ?? {}) as Record<string, number>) : undefined}
                  defaultPrice={defaultPrice}
                  defaultCost={showCost ? (values.unitCost ?? 0) : undefined}
                  onPriceChange={(next) => setValue('prices', next, revalidate)}
                  onCostChange={showCost ? (next) => setValue('costs', next, revalidate) : undefined}
                />
              </>
            )}
          </Section>

        </div>
        <aside className="split-aside new-model-aside">
          <NewProductSummary
            name={values.name ?? ''}
            code={modelCode}
            combos={combos}
            unitCost={showCost ? (values.unitCost ?? 0) : undefined}
            sellPrice={values.sellPrice ?? 0}
            prices={(values.prices ?? {}) as Record<string, number>}
            pending={create.isPending}
            error={isSubmitted ? firstError : undefined}
            onSaveAndAddAnother={() => {
              after.current = 'another'
              void submit()
            }}
          />
        </aside>
      </form>
    </>
  )
}
