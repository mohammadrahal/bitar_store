'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { ReceiptForm } from '@/components/receiving/receipt-form'
import { ReceiptsPanel } from '@/components/receiving/receipts-panel'
import { SuppliersPanel } from '@/components/receiving/suppliers-panel'
import { PageHeader } from '@/components/shared/page-header'
import { PreviewBadge } from '@/components/shared/preview-badge'
import { usePermission } from '@/hooks/use-permission'

/**
 * BL-06: suppliers and what they delivered. Receipts always land at the
 * warehouse, a draft has no effect, and only a super admin or manager confirms
 * one. Confirmed figures are where every cost in the app comes from.
 */
export function ReceivingView() {
  const { can } = usePermission()
  const [adding, setAdding] = useState(false)

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Receiving"
        description="Supplier deliveries into the warehouse, and the cost each line was bought at."
        actions={
          can('receipts.enter') ? (
            <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
              <Plus size={16} aria-hidden="true" />
              New receipt
            </button>
          ) : null
        }
      />

      <PreviewBadge feature="Suppliers and supplier receipts" />

      <ReceiptsPanel />
      <SuppliersPanel />

      {adding && <ReceiptForm onClose={() => setAdding(false)} />}
    </>
  )
}
