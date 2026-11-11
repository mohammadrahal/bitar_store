'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PackageSearch, ScanLine, X } from 'lucide-react'
import { toast } from 'sonner'
import { swatchClass } from '@/components/sales/catalog-line-picker'
import { SearchInput } from '@/components/shared/search-input'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useMirroredBranches } from '@/hooks/use-stock'
import { formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'
import { listSaleModels, listSaleVariants } from '@/services/sale-picker.service'
import { findVariantByCode, searchVariants } from '@/services/variant-search.service'
import type { VariantOption } from '@/types'

const PAGE = 24
const SKU_SEARCH_LIMIT = 24
const MIN_SKU_SEARCH = 2
/** EAN-8 to EAN-14 and similar: all digits, long enough that no product name or partial code looks like one. */
const BARCODE = /^\d{8,14}$/

/** Tags print barcodes in groups ("2 765521 241308"); typed that way it is still one code. */
function asBarcode(term: string): string | null {
  const compact = /^[\d\s]+$/.test(term) ? term.replace(/\s+/g, '') : term
  return BARCODE.test(compact) ? compact : null
}

function left(option: VariantOption, inCart: Record<string, number>): number {
  return Math.max(0, (option.available ?? 0) - (inCart[option.variantId] ?? 0))
}

/**
 * The till's product picker: tap a product, tap a size, it is in the cart.
 *
 * No quantity field and no Add button per row. one tap adds one, a second tap
 * adds another, and the cart is where a count is corrected. The open product's
 * sizes sit above the grid so switching product is one tap and the grid never
 * moves. A scanner (or a typed SKU / barcode) followed by Enter adds the exact
 * match straight to the cart without touching the grid at all.
 */
export function TillCatalog({
  branchId,
  inCart,
  onAdd,
}: {
  branchId: string
  inCart: Record<string, number>
  onAdd: (option: VariantOption, quantity: number) => void
}) {
  const [input, setInput] = useState('')
  const search = useDebouncedValue(input, 200)
  const term = search.trim()
  const [openId, setOpenId] = useState('')
  const [shown, setShown] = useState(PAGE)
  const [flash, setFlash] = useState('')
  /* Set by a scan: the panel shows only this SKU until asked for the rest. */
  const [scanned, setScanned] = useState<VariantOption | null>(null)
  const mirrored = useMirroredBranches()
  const searchRef = useRef<HTMLInputElement>(null)
  const lookupSeq = useRef(0)
  const ready = mirrored !== null && Boolean(branchId)

  useEffect(() => {
    searchRef.current?.focus()
  }, [branchId])

  useEffect(() => {
    setShown(PAGE)
  }, [term])

  const models = useQuery({
    queryKey: ['catalog', 'models', term.toLowerCase()],
    queryFn: () => listSaleModels(term, 500),
    enabled: ready,
    staleTime: 60_000,
  })

  const skuSearchReady = term.length >= MIN_SKU_SEARCH
  const skus = useQuery({
    queryKey: ['catalog', 'till-variant-search', branchId, term.toLowerCase()],
    queryFn: async () => (await searchVariants(term, SKU_SEARCH_LIMIT, branchId)).filter((o) => (o.available ?? 0) > 0),
    enabled: ready && skuSearchReady,
    staleTime: 15_000,
  })

  const products = models.data ?? []

  /* One product left is not a choice: open it. A barcode is not a product
     search, though. it is resolved to its own SKU below. */
  useEffect(() => {
    if (term && !asBarcode(term) && products.length === 1) {
      setOpenId(products[0]!.productId)
      setScanned(null)
    }
  }, [term, products])

  const variants = useQuery({
    queryKey: ['catalog', 'variants', branchId, openId],
    queryFn: () => listSaleVariants(branchId, openId),
    enabled: ready && Boolean(openId),
    staleTime: 30_000,
  })

  const openProduct = products.find((product) => product.productId === openId)

  const variantsRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (openId) variantsRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [openId])

  const addOne = (option: VariantOption) => {
    if (left(option, inCart) <= 0) {
      toast.message(`No more ${option.productName} ${option.color} / ${option.size} in stock here.`)
      return
    }
    onAdd(option, 1)
    setFlash(option.variantId)
    window.setTimeout(() => setFlash((current) => (current === option.variantId ? '' : current)), 450)
  }

  const openProductPanel = (productId: string, only: VariantOption | null = null) => {
    setOpenId(productId)
    setScanned(only)
  }

  /* Puts the one SKU in front of the cashier, who confirms it with a tap. */
  const selectScanned = (match: VariantOption) => {
    setInput('')
    openProductPanel(match.productId, match)
  }

  /* A code that resolves to one SKU shows that SKU, not its whole model.
     Returns whether it did, so the caller knows to stop there. */
  const selectByCode = async (code: string): Promise<boolean> => {
    const lookup = ++lookupSeq.current
    const match = await findVariantByCode(code, branchId).catch(() => null)
    if (lookup !== lookupSeq.current || !match) return false
    selectScanned(match)
    return true
  }

  /* Scanners type the code and press Enter faster than the debounce, so Enter
     looks the code up itself instead of trusting the list on screen. */
  const onSearchKeyDown = async (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    const code = input.trim()
    if (code.length < MIN_SKU_SEARCH) return
    if (await selectByCode(asBarcode(code) ?? code)) return
    const matches = (await searchVariants(code, 5, branchId)).filter((o) => (o.available ?? 0) > 0)
    if (matches.length === 1) selectScanned(matches[0]!)
    else if (matches.length === 0) toast.message(`Nothing in stock matches “${code}”.`)
  }

  /* Not every scanner sends Enter, and a code typed off a tag often has none.
     A full barcode in the box is unambiguous, so it selects itself. */
  useEffect(() => {
    const code = asBarcode(term)
    if (!ready || !code) return
    void selectByCode(code)
  }, [term, ready])

  const scannedTile = scanned
    ? (variants.data?.find((option) => option.variantId === scanned.variantId) ?? scanned)
    : null

  const visible = products.slice(0, shown)
  const skuMatches = skuSearchReady ? (skus.data ?? []) : []
  const showSkuMatches = skuMatches.length > 0 && !openId

  return (
    <div className="till-catalog">
      <div className="till-catalog-search" onKeyDown={onSearchKeyDown}>
        <SearchInput
          ref={searchRef}
          className="search-field--full search-field--till"
          value={input}
          onChange={setInput}
          placeholder="Search a product, or scan a barcode"
          aria-label="Search products or scan a barcode"
        />
        <span className="till-catalog-scan-hint" aria-hidden="true">
          <ScanLine size={14} /> Scan or type a barcode to find that exact item
        </span>
      </div>

      {openId ? (
        <section
          ref={variantsRef}
          className="till-variants"
          aria-label={`Sizes and colours of ${openProduct?.productName ?? 'product'}`}
        >
          <header className="till-variants-head">
            <div>
              <h2>{openProduct?.productName ?? scanned?.productName ?? variants.data?.[0]?.productName ?? 'Product'}</h2>
              <p>
                {scannedTile
                  ? 'Scanned item. Tap it to add it to the cart.'
                  : 'Tap a size to add it. Tap again to add another.'}
              </p>
            </div>
            <button type="button" className="icon-btn" aria-label="Close product" onClick={() => openProductPanel('')}>
              <X size={18} />
            </button>
          </header>
          {scannedTile ? (
            <>
              <VariantTiles options={[scannedTile]} inCart={inCart} flash={flash} onAdd={addOne} scanned />
              <button type="button" className="text-btn till-variants-all" onClick={() => setScanned(null)}>
                Show all sizes of this product
              </button>
            </>
          ) : variants.isPending ? (
            <div className="till-tiles">
              {Array.from({ length: 6 }, (_, index) => (
                <span key={index} className="till-tile till-tile--skeleton" aria-hidden="true" />
              ))}
            </div>
          ) : variants.isError ? (
            <p className="field-error">Could not load this product. Try again.</p>
          ) : (variants.data ?? []).length === 0 ? (
            <p className="till-catalog-note">This product has no sizes set up.</p>
          ) : (
            <VariantTiles
              options={variants.data ?? []}
              inCart={inCart}
              flash={flash}
              onAdd={addOne}
            />
          )}
        </section>
      ) : null}

      {showSkuMatches ? (
        <section className="till-variants" aria-label="Matching items">
          <header className="till-variants-head">
            <div>
              <h2>Matching items</h2>
              <p>Tap one to add it.</p>
            </div>
          </header>
          <VariantTiles options={skuMatches} inCart={inCart} flash={flash} onAdd={addOne} withProduct />
        </section>
      ) : null}

      {models.isPending ? (
        <div className="till-products">
          {Array.from({ length: 8 }, (_, index) => (
            <span key={index} className="till-product till-product--skeleton" aria-hidden="true" />
          ))}
        </div>
      ) : models.isError ? (
        <p className="field-error">Could not load products.</p>
      ) : products.length === 0 && !showSkuMatches ? (
        <div className="till-catalog-empty">
          <PackageSearch size={22} aria-hidden="true" />
          <strong>No products match “{term}”</strong>
          <span>Check the spelling, or scan the barcode on the tag.</span>
        </div>
      ) : (
        <>
          <div className="till-products" role="group" aria-label="Products">
            {visible.map((product) => {
              const open = product.productId === openId
              return (
                <button
                  key={product.productId}
                  type="button"
                  aria-pressed={open}
                  className={cn('till-product', open && 'till-product--open')}
                  onClick={() => openProductPanel(open && !scanned ? '' : product.productId)}
                >
                  <span className="till-product-name">{product.productName}</span>
                  <span className="till-product-meta">
                    <span className="tabular">{product.productCode}</span>
                    {product.variantCount != null ? (
                      <span>
                        {product.variantCount} {product.variantCount === 1 ? 'size' : 'sizes'}
                      </span>
                    ) : null}
                  </span>
                </button>
              )
            })}
          </div>
          {products.length > shown ? (
            <button type="button" className="btn btn-secondary till-catalog-more" onClick={() => setShown((n) => n + PAGE)}>
              Show more products ({products.length - shown})
            </button>
          ) : null}
        </>
      )}
    </div>
  )
}

function VariantTiles({
  options,
  inCart,
  flash,
  onAdd,
  withProduct = false,
  scanned = false,
}: {
  options: VariantOption[]
  inCart: Record<string, number>
  flash: string
  onAdd: (option: VariantOption) => void
  withProduct?: boolean
  /** A single SKU picked by a scan, drawn larger so it is the obvious next tap. */
  scanned?: boolean
}) {
  const sorted = [...options].sort((a, b) => Number((b.available ?? 0) > 0) - Number((a.available ?? 0) > 0))
  return (
    <div className={cn('till-tiles', scanned && 'till-tiles--scanned')}>
      {sorted.map((option) => {
        const remaining = left(option, inCart)
        const count = inCart[option.variantId] ?? 0
        const out = (option.available ?? 0) <= 0
        return (
          <button
            key={option.variantId}
            type="button"
            className={cn(
              'till-tile',
              count > 0 && 'till-tile--in-cart',
              flash === option.variantId && 'till-tile--flash',
            )}
            disabled={remaining <= 0}
            onClick={() => onAdd(option)}
            aria-label={`Add ${option.productName} ${option.color} / ${option.size}, ${formatPrice(option.sellPrice)}`}
          >
            {count > 0 ? <span className="till-tile-badge tabular">{count}</span> : null}
            {withProduct ? <span className="till-tile-product">{option.productName}</span> : null}
            <span className="till-tile-top">
              <span className="till-tile-size">{option.size || '—'}</span>
              <span className="till-tile-color">
                <span className={swatchClass(option.color)} aria-hidden="true" />
                {option.color}
              </span>
            </span>
            <span className="till-tile-foot">
              <strong className="tabular">{formatPrice(option.sellPrice)}</strong>
              <span className={cn('tabular', remaining <= 2 && 'till-tile-low')}>
                {out ? 'Out of stock' : remaining === 0 ? 'All in cart' : `${remaining} left`}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
