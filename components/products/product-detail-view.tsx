'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Archive, ArchiveRestore, ArrowLeft, Pencil, Plus } from 'lucide-react'
import { AddVariantsDrawer } from '@/components/products/add-variants-drawer'
import { ArchiveProductDialog } from '@/components/products/archive-product-dialog'
import { ProductForm } from '@/components/products/product-form'
import { SkuBarcodesDialog } from '@/components/products/sku-barcodes-dialog'
import { SkuPriceDialog } from '@/components/products/sku-price-dialog'
import { SkuTable } from '@/components/products/sku-table'
import { Can } from '@/components/shared/can'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useProduct } from '@/hooks/use-products'
import { usePermission } from '@/hooks/use-permission'
import { formatPrice } from '@/lib/format'

type Dialog =
  | { kind: 'edit' | 'variants' | 'archive' }
  | { kind: 'price' | 'barcodes'; variantId: string }

export function ProductDetailView({ productId }: { productId: string }) {
  const { can } = usePermission()
  const { data: product, isPending, isError, error, refetch } = useProduct(productId)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const close = () => setDialog(null)

  if (isPending) return <Skeleton rows={1} stats={0} />
  if (isError) return <ErrorState title="Could not load this product" error={error} onRetry={() => void refetch()} />

  const count = product.variants.length
  const details = [product.details?.season, product.details?.brand, product.details?.material].filter(Boolean)
  const prices = can('costs.view')
    ? `From ${formatPrice(product.sellPrice)} · Cost ${formatPrice(product.costPrice)}`
    : `From ${formatPrice(product.sellPrice)}`
  /* Looked up on every render so the dialogs show the SKU as it is after a refetch. */
  const selected = dialog && 'variantId' in dialog ? product.variants.find((variant) => variant.id === dialog.variantId) : undefined

  return (
    <>
      <Link href="/products" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        Products
      </Link>
      <PageHeader
        eyebrow={product.archived ? `${product.code} · Archived` : product.code}
        title={product.name}
        description={[product.category, ...details].join(' · ')}
        actions={
          <>
            {!product.archived && (
              <Can permission="catalog.edit">
                <button type="button" className="btn btn-secondary" onClick={() => setDialog({ kind: 'edit' })}>
                  <Pencil size={16} aria-hidden="true" />
                  Edit
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setDialog({ kind: 'variants' })}>
                  <Plus size={16} aria-hidden="true" />
                  Add variants
                </button>
              </Can>
            )}
            <Can permission="catalog.edit">
              <button type="button" className="btn btn-secondary" onClick={() => setDialog({ kind: 'archive' })}>
                {product.archived ? <ArchiveRestore size={16} aria-hidden="true" /> : <Archive size={16} aria-hidden="true" />}
                {product.archived ? 'Reactivate' : 'Archive'}
              </button>
            </Can>
          </>
        }
      />

      {product.archived && (
        <p className="notice" role="status">
          This model is archived. It is left out of sales, transfers and counts; its history stays readable.
        </p>
      )}

      <Panel title={`${count} ${count === 1 ? 'variant' : 'variants'}`} description={count ? prices : undefined}>
        {count === 0 ? (
          <div className="panel-body">
            <p className="subtitle">No variants on this model yet.</p>
          </div>
        ) : (
          <SkuTable
            product={product}
            onPrice={(variant) => setDialog({ kind: 'price', variantId: variant.id })}
            onBarcodes={(variant) => setDialog({ kind: 'barcodes', variantId: variant.id })}
          />
        )}
      </Panel>

      {dialog?.kind === 'edit' && <ProductForm key={product.id} product={product} onClose={close} />}
      {dialog?.kind === 'variants' && <AddVariantsDrawer product={product} onClose={close} />}
      {dialog?.kind === 'archive' && <ArchiveProductDialog product={product} onClose={close} />}
      {dialog?.kind === 'price' && selected && <SkuPriceDialog variant={selected} onClose={close} />}
      {dialog?.kind === 'barcodes' && selected && (
        <SkuBarcodesDialog variant={selected} barcodes={product.barcodes[selected.id] ?? []} onClose={close} />
      )}
    </>
  )
}
