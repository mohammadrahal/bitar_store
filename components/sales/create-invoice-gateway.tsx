'use client'

import Link from 'next/link'
import { ArrowLeft, ArrowLeftRight, ScanLine } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'

/**
 * The API only creates invoices from an existing sale or transfer (`POST /invoices`).
 * There is no free-form wholesale body yet, so this page routes staff to those flows.
 */
export function CreateInvoiceGateway() {
  return (
    <>
      <Link href="/sales/invoices" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        Invoices ledger
      </Link>
      <PageHeader
        eyebrow="Fiscal registry"
        title="Create an invoice"
        description="The server only creates invoices from an existing sale or transfer. Pick the path that matches what you are issuing."
      />
      <div className="create-invoice-gateway-grid">
        <Panel
          title="Retail invoice (B2C)"
          description="Ring up the sale first, then issue the fiscal invoice from the sale screen."
        >
          <div className="panel-body stack gap-sm">
            <p className="muted text-sm" style={{ margin: 0 }}>
              Customer name and phone are optional on the invoice.
            </p>
            <Link href="/sales/new" className="btn btn-primary">
              <ScanLine size={16} aria-hidden="true" />
              New sale
            </Link>
          </div>
        </Panel>
        <Panel
          title="Supply invoice (B2B)"
          description="Created from a transfer that left the warehouse. Draft until finalized with a B2B number."
        >
          <div className="panel-body stack gap-sm">
            <p className="muted text-sm" style={{ margin: 0 }}>
              Open a sent transfer to create it, then set prices and finalize on the invoice screen.
            </p>
            <Link href="/transfers" className="btn btn-primary">
              <ArrowLeftRight size={16} aria-hidden="true" />
              Transfers
            </Link>
          </div>
        </Panel>
      </div>
    </>
  )
}
