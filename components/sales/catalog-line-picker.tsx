'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { QtyStepper } from '@/components/sales/qty-stepper'
import { SearchInput } from '@/components/shared/search-input'
import { Pagination } from '@/components/shared/pagination'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useMirroredBranches } from '@/hooks/use-stock'
import { formatPrice } from '@/lib/format'
import {
  listSaleModels,
  listSaleModelsAtBranch,
  listSaleVariants,
  listSaleVariantsAtBranch,
} from '@/services/sale-picker.service'
import { searchVariants } from '@/services/variant-search.service'
import type { SaleModelOption, VariantOption } from '@/types'

const PRODUCT_PAGE_SIZE = 12
const SKU_SEARCH_LIMIT = 30
const MIN_SKU_SEARCH = 2

function skuSearchReady(term: string): boolean {
  const trimmed = term.trim()
  if (trimmed.length >= MIN_SKU_SEARCH) return true
  return /^[\x21-\x7E]{4,64}$/.test(trimmed)
}

/**
 * What the count in the row means for adding a line.
 *
 * - `enforce`. the till. `POST /sales` refuses a line it cannot cover, so a
 *   row at zero cannot be added at all.
 * - `warn`. preparing a transfer. `POST /transfers` only writes a draft and
 *   moves nothing; the stock is checked at `POST /transfers/:id/dispatch`,
 *   which also accepts sending fewer than asked. So a draft for stock that has
 *   not arrived yet is allowed, and the row says what is there today.
 * - `ignore`. receiving, and anything else where on-hand is context only.
 */
export type Availability = 'enforce' | 'warn' | 'ignore'

function leftToSell(option: VariantOption, inCart: Record<string, number>): number {
  return Math.max(0, (option.available ?? 0) - (inCart[option.variantId] ?? 0))
}

/** Column count of the model table, so a nested row can span it. */
const MODEL_COLUMNS = 4

export function swatchClass(color: string): string {
  const key = color.trim().toLowerCase()
  if (key.includes('red')) return 'catalog-color-swatch catalog-color-swatch--red'
  if (key.includes('blue')) return 'catalog-color-swatch catalog-color-swatch--blue'
  if (key.includes('green')) return 'catalog-color-swatch catalog-color-swatch--green'
  if (key.includes('black')) return 'catalog-color-swatch catalog-color-swatch--black'
  if (key.includes('white')) return 'catalog-color-swatch catalog-color-swatch--white'
  if (key.includes('gold')) return 'catalog-color-swatch catalog-color-swatch--gold'
  return 'catalog-color-swatch'
}

function VariantRows({
  rows,
  inCart,
  qtyFor,
  setQty,
  onAdd,
  availability,
  addLabel,
  itemLabel,
  nested = false,
  pickerUi = 'default',
}: {
  rows: VariantOption[]
  inCart: Record<string, number>
  qtyFor: (id: string) => number
  setQty: (id: string, quantity: number, max?: number) => void
  onAdd: (option: VariantOption) => void
  availability: Availability
  addLabel: string
  itemLabel: string
  /** Inside an expanded model row: drop the outer border, the row has one. */
  nested?: boolean
  pickerUi?: 'default' | 'till'
}) {
  const enforceStock = availability === 'enforce'
  const showsStock = availability !== 'ignore'
  const till = pickerUi === 'till'
  const listed = enforceStock ? rows.filter((option) => (option.available ?? 0) > 0) : rows
  if (listed.length === 0) {
    return (
      <p className="invoice-picker-hint">
        {enforceStock ? 'Nothing in stock for this model at this branch.' : 'No variants to add for this model.'}
      </p>
    )
  }
  return (
    <div className={nested ? 'catalog-picker-variants-wrap' : 'invoice-picker-table-wrap'}>
      <table className="invoice-picker-table">
        <caption className="sr-only">Variants. {itemLabel}</caption>
        <thead>
          <tr>
            <th scope="col">{till ? 'Item' : 'Color / size'}</th>
            <th scope="col">SKU</th>
            <th scope="col" className="num">
              {till && showsStock ? 'Stock' : showsStock ? 'Available' : 'On hand'}
            </th>
            <th scope="col" className="num">
              {till ? 'Price' : 'Unit'}
            </th>
            <th scope="col" className="num">
              Qty
            </th>
            <th scope="col">
              <span className="sr-only">Add</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {listed.map((option) => {
            const inBasket = inCart[option.variantId] ?? 0
            const left = leftToSell(option, inCart)
            const canAdd = !enforceStock || left > 0
            const maxQty = enforceStock ? left : 9999
            /* A disabled row with a bare "0" in it reads as a broken form. Say
               which of the two it is: nothing here to sell, or more asked for
               than is here. which a transfer is allowed to do. */
            const note =
              !showsStock || left > qtyFor(option.variantId)
                ? null
                : left === 0
                  ? enforceStock
                    ? 'None here'
                    : 'None here yet'
                  : 'More than is here'
            return (
              <tr key={option.variantId} className={inBasket > 0 ? 'catalog-picker-row--added' : undefined}>
                <td>
                  {till ? (
                    <span className="catalog-variant-label">
                      <span className={swatchClass(option.color)} aria-hidden="true" />
                      <span>
                        {option.color} / {option.size}
                      </span>
                    </span>
                  ) : (
                    <>
                      {option.color} / {option.size}
                    </>
                  )}
                </td>
                <td className="tabular invoice-muted">{option.sku}</td>
                <td className="num tabular catalog-stock-cell">
                  {till && showsStock ? (
                    <>
                      {left} in stock
                      {note && <small className="invoice-muted catalog-picker-note"> {note}</small>}
                    </>
                  ) : (
                    <>
                      {showsStock ? left : (option.available ?? 0)}
                      {note && <small className="invoice-muted catalog-picker-note"> {note}</small>}
                    </>
                  )}
                </td>
                <td className="num tabular">{formatPrice(option.sellPrice)}</td>
                <td className="num catalog-qty-cell">
                  {till ? (
                    <QtyStepper
                      compact
                      hideHint
                      value={qtyFor(option.variantId)}
                      max={maxQty}
                      label={`Quantity for ${option.sku}`}
                      onChange={(qty) =>
                        setQty(option.variantId, qty, enforceStock ? maxQty : undefined)
                      }
                    />
                  ) : (
                    <input
                      type="number"
                      inputMode="numeric"
                      step={1}
                      className="invoice-qty-input tabular"
                      min={1}
                      max={maxQty}
                      disabled={!canAdd}
                      value={qtyFor(option.variantId)}
                      onChange={(event) =>
                        setQty(option.variantId, Number(event.target.value) || 1, enforceStock ? maxQty : undefined)
                      }
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return
                        event.preventDefault()
                        if (canAdd) onAdd(option)
                      }}
                      aria-label={`Quantity for ${option.sku}`}
                    />
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className={`btn btn-ghost btn-sm invoice-picker-add${till ? ' btn-sale-catalog-add' : ''}`}
                    disabled={!canAdd}
                    onClick={() => onAdd(option)}
                  >
                    <Plus size={14} aria-hidden="true" />
                    {addLabel}
                    {inBasket > 0 ? ` (${inBasket})` : ''}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Catalog picker: search, open a model, add its variants.
 *
 * The model list and the variants of the open model sit on **one** screen. The
 * earlier version swapped the whole picker for one model's variants, which cost
 * a click in (Select), a click out (All products) and the scroll position on
 * every line. six clicks to add two variants of neighbouring models. Expanding
 * in place keeps the search, the list and the chosen row where they were, so
 * every line after the first is one click. A search that narrows to a single
 * model opens it on its own: there is no choice left to make. Matching SKUs
 * stay listed while a model is open, so a scanned or typed code is still a
 * direct add.
 */
export function CatalogLinePicker({
  branchId,
  inCart,
  onAdd,
  availability = 'ignore',
  /** `branchStock` lists only models and SKUs recorded at `branchId`. */
  modelScope = 'catalog',
  addLabel = 'Add',
  searchPlaceholder = 'Filter models or search SKU / barcode',
  searchAriaLabel = 'Filter products',
  itemLabel = 'add line',
  className = 'invoice-picker',
  pickerUi = 'default',
}: {
  branchId: string
  inCart: Record<string, number>
  onAdd: (option: VariantOption, quantity: number) => void
  availability?: Availability
  modelScope?: 'catalog' | 'branchStock'
  addLabel?: string
  searchPlaceholder?: string
  searchAriaLabel?: string
  itemLabel?: string
  className?: string
  pickerUi?: 'default' | 'till'
}) {
  const till = pickerUi === 'till'
  const [input, setInput] = useState('')
  const search = useDebouncedValue(input, 220)
  const [productPage, setProductPage] = useState(1)
  const [openProductId, setOpenProductId] = useState('')
  const [qtyByVariant, setQtyByVariant] = useState<Record<string, number>>({})
  const mirrored = useMirroredBranches()
  const enforceStock = availability === 'enforce'

  const branchStock = modelScope === 'branchStock'

  /* One match left is not a choice. Open it so the variants are already there.
     Keyed on the id so closing it by hand is not undone on the next render,
     and cleared with the search so the same term can open it again later. */
  const autoOpened = useRef('')

  useEffect(() => {
    setProductPage(1)
    setOpenProductId('')
    autoOpened.current = ''
  }, [search, branchId, modelScope])

  const modelsQuery = useQuery({
    queryKey: branchStock
      ? ['catalog', 'models-at-branch', branchId, search.trim().toLowerCase()]
      : ['catalog', 'models', search.trim().toLowerCase()],
    queryFn: () =>
      branchStock ? listSaleModelsAtBranch(branchId, search, 500) : listSaleModels(search, 500),
    enabled: mirrored !== null && Boolean(branchId),
    staleTime: 60_000,
  })

  const products = modelsQuery.data ?? []

  useEffect(() => {
    if (products.length !== 1 || !search.trim()) return
    const only = products[0]!.productId
    if (autoOpened.current === only) return
    autoOpened.current = only
    setOpenProductId(only)
  }, [products, search])

  const variantsQuery = useQuery({
    queryKey: branchStock
      ? ['catalog', 'variants-at-branch', branchId, openProductId]
      : ['catalog', 'variants', branchId, openProductId],
    queryFn: () =>
      branchStock
        ? listSaleVariantsAtBranch(branchId, openProductId)
        : listSaleVariants(branchId, openProductId),
    enabled: mirrored !== null && Boolean(branchId && openProductId),
    staleTime: 30_000,
  })

  const skuSearchQuery = useQuery({
    queryKey: ['catalog', 'variant-search', branchId, search.trim().toLowerCase(), modelScope, enforceStock],
    queryFn: async () => {
      const matches = await searchVariants(search, SKU_SEARCH_LIMIT, branchId)
      return enforceStock || branchStock
        ? matches.filter((option) => (option.available ?? 0) > 0)
        : matches
    },
    enabled: mirrored !== null && Boolean(branchId) && skuSearchReady(search),
    staleTime: 15_000,
  })

  const productPageCount = Math.max(1, Math.ceil(products.length / PRODUCT_PAGE_SIZE))
  const currentProductPage = Math.min(productPage, productPageCount)
  const visibleProducts = products.slice(
    (currentProductPage - 1) * PRODUCT_PAGE_SIZE,
    currentProductPage * PRODUCT_PAGE_SIZE,
  )

  const setQty = (variantId: string, quantity: number, max?: number) => {
    const cap = max ?? 9999
    const qty = Math.max(1, Math.min(cap, quantity))
    setQtyByVariant((current) => ({ ...current, [variantId]: qty }))
  }

  const qtyFor = (variantId: string) => qtyByVariant[variantId] ?? 1

  const addRow = (option: VariantOption) => {
    const left = leftToSell(option, inCart)
    if (enforceStock && left <= 0) return
    const qty = enforceStock ? Math.min(qtyFor(option.variantId), left) : qtyFor(option.variantId)
    onAdd(option, qty)
    setQty(option.variantId, 1)
  }

  const skuMatches = useMemo(() => {
    if (!skuSearchReady(search)) return []
    return skuSearchQuery.data ?? []
  }, [search, skuSearchQuery.data])

  const showSkuMatches = skuMatches.length > 0 && skuSearchReady(search)

  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (till) searchRef.current?.focus()
  }, [till, branchId])

  /* Scanners end every code with Enter. On the till the picker sits inside the
     sale form, so an unhandled Enter would confirm the sale mid-basket. */
  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (!till || input.trim() !== search.trim() || skuMatches.length !== 1) return
    const only = skuMatches[0]!
    if (enforceStock && leftToSell(only, inCart) <= 0) return
    onAdd(only, 1)
    setInput('')
  }

  const variantRowProps = {
    inCart,
    qtyFor,
    setQty,
    onAdd: addRow,
    availability,
    addLabel,
    itemLabel,
    pickerUi,
  }

  return (
    <div className={className}>
      <div onKeyDown={onSearchKeyDown}>
        <SearchInput
          ref={searchRef}
          className={`search-field--full${till ? ' search-field--till' : ''}`}
          value={input}
          onChange={setInput}
          placeholder={searchPlaceholder}
          aria-label={searchAriaLabel}
        />
      </div>

      {modelsQuery.isPending && <p className="invoice-picker-hint">Loading catalog…</p>}
      {modelsQuery.isError && <p className="field-error">Could not load products.</p>}

      {!modelsQuery.isPending && products.length === 0 && !showSkuMatches && (
        <p className="invoice-picker-hint">
          {branchStock
            ? 'Nothing on hand at this location matches your search. Receive stock or post an opening count first.'
            : 'No active models match this filter.'}
        </p>
      )}

      {products.length > 0 && (
        <>
          {!till && (
            <p className="invoice-picker-hint">
              {branchStock
                ? `${products.length} ${products.length === 1 ? 'model' : 'models'} with stock here. Open one to pick size and color.`
                : `${products.length} ${products.length === 1 ? 'model' : 'models'}. Open one to pick color and size.`}
            </p>
          )}
          <div
            className={`invoice-picker-table-wrap invoice-picker-table-wrap--catalog${till ? ' invoice-picker-table-wrap--till' : ''}`}
          >
            <table className="invoice-picker-table">
              <caption className="sr-only">Product catalog</caption>
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Product</th>
                  <th scope="col" className="num">
                    Variants
                  </th>
                  <th scope="col">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleProducts.map((product) => {
                  const open = product.productId === openProductId
                  const toggle = () => setOpenProductId(open ? '' : product.productId)
                  return (
                    <ModelRow
                      key={product.productId}
                      product={product}
                      open={open}
                      onToggle={toggle}
                      variants={
                        variantsQuery.isPending ? (
                          <p className="invoice-picker-hint">Loading variants…</p>
                        ) : variantsQuery.isError ? (
                          <p className="field-error">Could not load variants for this model.</p>
                        ) : (
                          <VariantRows rows={variantsQuery.data ?? []} {...variantRowProps} nested />
                        )
                      }
                      tillOpen={till}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={currentProductPage}
            pageCount={productPageCount}
            total={products.length}
            pageSize={PRODUCT_PAGE_SIZE}
            onPage={setProductPage}
          />
        </>
      )}

      {showSkuMatches && (
        <section className="invoice-picker-sku-section" aria-label="SKU matches">
          <h3 className="invoice-picker-subhead">Matching SKUs. Add without opening the model</h3>
          {skuSearchQuery.isFetching && skuMatches.length === 0 ? (
            <p className="invoice-picker-hint">Searching SKUs…</p>
          ) : (
            <VariantRows rows={skuMatches} {...variantRowProps} />
          )}
        </section>
      )}
    </div>
  )
}

/**
 * A model and, when open, its variants in the row underneath.
 *
 * Two `<tr>` from one component, so React keys stay on the pair rather than on
 * an array the parent has to flatten.
 */
function ModelRow({
  product,
  open,
  onToggle,
  variants,
  tillOpen = false,
}: {
  product: SaleModelOption
  open: boolean
  onToggle: () => void
  variants: React.ReactNode
  tillOpen?: boolean
}) {
  const panelId = `catalog-variants-${product.productId}`
  return (
    <>
      <tr
        className={`catalog-picker-model${open ? ' catalog-picker-model--open' : ''}`}
        onClick={onToggle}
      >
        <td className="tabular catalog-picker-code">{product.productCode}</td>
        <td>
          <strong>{product.productName}</strong>
        </td>
        <td className="num tabular">
          {tillOpen && product.variantCount != null ? (
            <span className="catalog-picker-count">
              {product.variantCount} {product.variantCount === 1 ? 'variant' : 'variants'}
            </span>
          ) : (
            (product.variantCount ?? '')
          )}
        </td>
        <td className="catalog-picker-toggle-cell">
          <button
            type="button"
            className={`btn btn-ghost btn-sm invoice-picker-add${tillOpen ? ' btn-sale-catalog-open' : ''}`}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={tillOpen ? `${open ? 'Close' : 'Open'} ${product.productName}` : undefined}
            onClick={(event) => {
              event.stopPropagation()
              onToggle()
            }}
          >
            {tillOpen ? null : open ? 'Close' : 'Open'}
            <ChevronRight
              size={14}
              aria-hidden="true"
              className={`catalog-picker-chevron${open ? ' catalog-picker-chevron--open' : ''}`}
            />
          </button>
        </td>
      </tr>
      {open && (
        <tr className="catalog-picker-variants">
          <td colSpan={MODEL_COLUMNS} id={panelId}>
            {variants}
          </td>
        </tr>
      )}
    </>
  )
}
