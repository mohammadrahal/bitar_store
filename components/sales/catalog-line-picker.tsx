'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronRight, Plus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
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
 * - `enforce` — the till. `POST /sales` refuses a line it cannot cover, so a
 *   row at zero cannot be added at all.
 * - `warn` — preparing a transfer. `POST /transfers` only writes a draft and
 *   moves nothing; the stock is checked at `POST /transfers/:id/dispatch`,
 *   which also accepts sending fewer than asked. So a draft for stock that has
 *   not arrived yet is allowed, and the row says what is there today.
 * - `ignore` — receiving, and anything else where on-hand is context only.
 */
export type Availability = 'enforce' | 'warn' | 'ignore'

function leftToSell(option: VariantOption, inCart: Record<string, number>): number {
  return Math.max(0, (option.available ?? 0) - (inCart[option.variantId] ?? 0))
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
}: {
  rows: VariantOption[]
  inCart: Record<string, number>
  qtyFor: (id: string) => number
  setQty: (id: string, quantity: number, max?: number) => void
  onAdd: (option: VariantOption) => void
  availability: Availability
  addLabel: string
  itemLabel: string
}) {
  const enforceStock = availability === 'enforce'
  const showsStock = availability !== 'ignore'
  if (rows.length === 0) {
    return <p className="invoice-picker-hint">No variants to add for this model.</p>
  }
  return (
    <div className="invoice-picker-table-wrap">
      <table className="invoice-picker-table">
        <caption className="sr-only">Variants — {itemLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Color / size</th>
            <th scope="col">SKU</th>
            <th scope="col" className="num">
              {showsStock ? 'Available' : 'On hand'}
            </th>
            <th scope="col" className="num">
              Unit
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
          {rows.map((option) => {
            const inBasket = inCart[option.variantId] ?? 0
            const left = leftToSell(option, inCart)
            const canAdd = !enforceStock || left > 0
            const maxQty = enforceStock ? left : 9999
            /* A disabled row with a bare "0" in it reads as a broken form. Say
               which of the two it is: nothing here to sell, or more asked for
               than is here — which a transfer is allowed to do. */
            const note =
              !showsStock || left > qtyFor(option.variantId)
                ? null
                : left === 0
                  ? enforceStock
                    ? 'None here'
                    : 'None here yet'
                  : 'More than is here'
            return (
              <tr key={option.variantId}>
                <td>
                  {option.color} / {option.size}
                </td>
                <td className="tabular invoice-muted">{option.sku}</td>
                <td className="num tabular">
                  {showsStock ? left : (option.available ?? 0)}
                  {note && <small className="invoice-muted catalog-picker-note"> {note}</small>}
                </td>
                <td className="num tabular">{formatPrice(option.sellPrice)}</td>
                <td className="num">
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
                    aria-label={`Quantity for ${option.sku}`}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm invoice-picker-add"
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
}) {
  const [input, setInput] = useState('')
  const search = useDebouncedValue(input, 220)
  const [productPage, setProductPage] = useState(1)
  const [selected, setSelected] = useState<SaleModelOption | null>(null)
  const [qtyByVariant, setQtyByVariant] = useState<Record<string, number>>({})
  const mirrored = useMirroredBranches()
  const enforceStock = availability === 'enforce'

  const branchStock = modelScope === 'branchStock'

  useEffect(() => {
    setProductPage(1)
    setSelected(null)
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

  const variantsQuery = useQuery({
    queryKey: branchStock
      ? ['catalog', 'variants-at-branch', branchId, selected?.productId ?? '']
      : ['catalog', 'variants', branchId, selected?.productId ?? ''],
    queryFn: () =>
      branchStock
        ? listSaleVariantsAtBranch(branchId, selected!.productId)
        : listSaleVariants(branchId, selected!.productId),
    enabled: mirrored !== null && Boolean(branchId && selected?.productId),
    staleTime: 30_000,
  })

  const skuSearchQuery = useQuery({
    queryKey: ['catalog', 'variant-search', branchId, search.trim().toLowerCase(), modelScope],
    queryFn: async () => {
      const matches = await searchVariants(search, SKU_SEARCH_LIMIT, branchId)
      return branchStock ? matches.filter((option) => (option.available ?? 0) > 0) : matches
    },
    enabled: mirrored !== null && Boolean(branchId) && skuSearchReady(search) && !selected,
    staleTime: 15_000,
  })

  const products = modelsQuery.data ?? []
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
    if (!skuSearchReady(search) || selected) return []
    return skuSearchQuery.data ?? []
  }, [search, selected, skuSearchQuery.data])

  const showSkuMatches = skuMatches.length > 0 && skuSearchReady(search)

  const variantRowProps = {
    inCart,
    qtyFor,
    setQty,
    onAdd: addRow,
    availability,
    addLabel,
    itemLabel,
  }

  return (
    <div className={className}>
      <SearchInput
        className="search-field--full"
        value={input}
        onChange={setInput}
        placeholder={searchPlaceholder}
        aria-label={searchAriaLabel}
      />

      {selected ? (
        <>
          <button type="button" className="invoice-picker-back" onClick={() => setSelected(null)}>
            <ArrowLeft size={16} aria-hidden="true" />
            All products
          </button>
          <p className="invoice-picker-context">
            <span className="tabular">{selected.productCode}</span> · {selected.productName}
          </p>
          {variantsQuery.isPending ? (
            <p className="invoice-picker-hint">Loading variants…</p>
          ) : variantsQuery.isError ? (
            <p className="field-error">Could not load variants for this model.</p>
          ) : (
            <VariantRows rows={variantsQuery.data ?? []} {...variantRowProps} />
          )}
        </>
      ) : (
        <>
          {modelsQuery.isPending && <p className="invoice-picker-hint">Loading catalog…</p>}
          {modelsQuery.isError && <p className="field-error">Could not load products.</p>}

          {!modelsQuery.isPending && products.length === 0 && (
            <p className="invoice-picker-hint">
              {branchStock
                ? 'Nothing on hand at this location matches your search. Receive stock or post an opening count first.'
                : 'No active models match this filter.'}
            </p>
          )}

          {products.length > 0 && (
            <>
              <p className="invoice-picker-hint">
                {branchStock
                  ? `${products.length} ${products.length === 1 ? 'model' : 'models'} with stock here — choose one to pick size and color.`
                  : `${products.length} ${products.length === 1 ? 'model' : 'models'} — choose one to pick color and size.`}
              </p>
              <div className="invoice-picker-table-wrap invoice-picker-table-wrap--catalog">
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
                    {visibleProducts.map((product) => (
                      <tr key={product.productId}>
                        <td className="tabular">{product.productCode}</td>
                        <td>
                          <strong>{product.productName}</strong>
                        </td>
                        <td className="num tabular">{product.variantCount ?? '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm invoice-picker-add"
                            onClick={() => setSelected(product)}
                          >
                            Select
                            <ChevronRight size={14} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    ))}
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
              <h3 className="invoice-picker-subhead">Matching SKUs</h3>
              {skuSearchQuery.isFetching && skuMatches.length === 0 ? (
                <p className="invoice-picker-hint">Searching SKUs…</p>
              ) : (
                <VariantRows rows={skuMatches} {...variantRowProps} />
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
