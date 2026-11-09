'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Archive, ArchiveRestore, ArrowLeft, Pencil, Plus, Printer } from 'lucide-react'
import { printBarcodeLabels } from '@/components/products/barcode-print'
import { AddVariantsDrawer } from '@/components/products/add-variants-drawer'
import { ArchiveProductDialog } from '@/components/products/archive-product-dialog'
import { ProductForm } from '@/components/products/product-form'
import { SkuBarcodesDialog } from '@/components/products/sku-barcodes-dialog'
import { SkuPriceDialog } from '@/components/products/sku-price-dialog'
import { ProductStockHint } from '@/components/products/product-stock-hint'
import { SkuTable } from '@/components/products/sku-table'
import { Can } from '@/components/shared/can'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useProduct } from '@/hooks/use-products'
import { usePermission } from '@/hooks/use-permission'
import { formatPrice } from '@/lib/format'

type Dialog =
  | { kind: 'edit' | 'variants' | 'archive' }
  | { kind: 'price' | 'barcodes'; variantId: string }

export function ProductDetailView({ productId }: { productId: string }) {
  /* `?created=1` is set by the new-model form. It only changes the wording and
     which button is dark. the page is the same page either way. */
  const justCreated = useSearchParams().get('created') === '1'
  const { can } = usePermission()
  const { data: product, isPending, isError, error, refetch } = useProduct(productId)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const close = () => setDialog(null)
  useDocumentTitle(product?.name)

  if (isPending) return <Skeleton rows={1} stats={0} />
  if (isError) return <ErrorState title="Could not load this product" error={error} onRetry={() => void refetch()} />

  const count = product.variants.length
  const prices = `From ${formatPrice(product.sellPrice)}`
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
        description={product.category}
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

      {count > 0 && !product.archived && (
        <ProductStockHint productCode={product.code} justCreated={justCreated} />
      )}

      <Panel
        title={`${count} ${count === 1 ? 'variant' : 'variants'}`}
        description={count ? `${prices} · Available stock for the location in the header` : undefined}
        actions={
          count > 0 ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const labels = product.variants.flatMap((variant) => {
                  const codes = product.barcodes[variant.id] ?? []
                  return codes.map((row) => ({
                    productName: product.name,
                    variantLabel: `${variant.color} / ${variant.size}`,
                    sku: variant.sku,
                    code: row.code,
                  }))
                })
                printBarcodeLabels(labels)
              }}
            >
              <Printer size={16} aria-hidden="true" />
              Print all barcodes
            </button>
          ) : undefined
        }
      >
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
