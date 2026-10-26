'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'
import { ProductForm } from '@/components/products/product-form'
import { Can } from '@/components/shared/can'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useProduct } from '@/hooks/use-products'
import { usePermission } from '@/hooks/use-permission'
import { formatBarcode } from '@/lib/barcode'
import { formatPrice } from '@/lib/format'

export function ProductDetailView({ productId }: { productId: string }) {
  const { can } = usePermission()
  const { data: product, isPending, isError, error, refetch } = useProduct(productId)
  const [editing, setEditing] = useState(false)

  if (isPending) return <Skeleton rows={1} stats={0} />
  if (isError) return <ErrorState title="Could not load this product" error={error} onRetry={() => void refetch()} />

  const descriptionParts = [product.category, `${product.variants.length} ${product.variants.length === 1 ? 'variant' : 'variants'}`]

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title={product.name}
        description={descriptionParts.join(' · ')}
        actions={
          <>
            <Can action="products:edit">
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
                <Pencil size={16} aria-hidden="true" />
                Edit
              </button>
            </Can>
            <Link href="/products" className="btn btn-secondary">
              <ArrowLeft size={16} aria-hidden="true" />
              All products
            </Link>
          </>
        }
      />

      <Panel
        title="Variants"
        description={
          can('products:read-cost')
            ? `Sell ${formatPrice(product.sellPrice)} · Cost ${formatPrice(product.costPrice)}`
            : `Sell ${formatPrice(product.sellPrice)}`
        }
      >
        {product.variants.length === 0 ? (
          <div className="panel-body">
            <p className="subtitle">No variants on this product yet.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Size and color variants for {product.name}</caption>
              <thead>
                <tr>
                  <th scope="col">Size</th>
                  <th scope="col">Color</th>
                  <th scope="col">SKU</th>
                  <th scope="col">Barcode</th>
                </tr>
              </thead>
              <tbody>
                {product.variants.map((variant) => (
                  <tr key={variant.id}>
                    <td>{variant.size}</td>
                    <td>{variant.color}</td>
                    <td className="tabular">{variant.sku}</td>
                    <td className="tabular">{variant.barcode ? formatBarcode(variant.barcode) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {editing && <ProductForm key={product.id} product={product} onClose={() => setEditing(false)} />}
    </>
  )
}
