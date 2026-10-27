'use client'

import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { useSetProductArchived } from '@/hooks/use-products'
import type { ProductWithVariants } from '@/types'

/** Archiving keeps history and only hides the model from pickers; the service refuses while stock remains. */
export function ArchiveProductDialog({ product, onClose }: { product: ProductWithVariants; onClose: () => void }) {
  const archive = useSetProductArchived()
  const archiving = !product.archived

  return (
    <ConfirmDialog
      title={archiving ? `Archive ${product.name}?` : `Reactivate ${product.name}?`}
      description={
        archiving
          ? `${product.code} leaves sales, transfer and count pickers. Its invoices and movement history stay readable, and you can reactivate it any time.`
          : `${product.code} and its ${product.variants.length} variants become available in pickers again.`
      }
      confirmLabel={archiving ? 'Archive model' : 'Reactivate'}
      tone={archiving ? 'danger' : 'default'}
      onResolve={(confirmed) => {
        onClose()
        if (confirmed) archive.mutate({ productId: product.id, archived: archiving })
      }}
    />
  )
}
