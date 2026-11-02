'use client'

import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { B2cRetailSalesPanel } from '@/components/sales/b2c-retail-sales-panel'
import { Can } from '@/components/shared/can'
import { PageHeader } from '@/components/shared/page-header'
import { usePermission } from '@/hooks/use-permission'

/** Till sales for the current business date, from `GET /sales`. */
export function RetailSalesView() {
  const router = useRouter()
  const { can } = usePermission()
  const startSale = () => router.push('/sales/new')
  const networkSales = can('locations.view_all')

  return (
    <>
      <PageHeader
        eyebrow="Sales"
        title={networkSales ? 'B2C · Retail' : 'Sales'}
        description="In-store sales from the till, for the business date the server is on."
        actions={
          <Can permission="sales.create">
            <button type="button" className="btn btn-primary" onClick={startSale}>
              <Plus size={16} aria-hidden="true" />
              New sale
            </button>
          </Can>
        }
      />
      <B2cRetailSalesPanel onCreate={startSale} />
    </>
  )
}
