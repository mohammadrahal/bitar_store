'use client'

import { CatalogLinePicker } from '@/components/sales/catalog-line-picker'
import type { VariantOption } from '@/types'

export function InvoiceLinePicker({
  branchId,
  inCart,
  onAdd,
}: {
  branchId: string
  inCart: Record<string, number>
  onAdd: (option: VariantOption, quantity: number) => void
}) {
  return (
    <CatalogLinePicker
      branchId={branchId}
      inCart={inCart}
      onAdd={onAdd}
      searchAriaLabel="Filter products for invoice"
      itemLabel="add to invoice"
    />
  )
}
