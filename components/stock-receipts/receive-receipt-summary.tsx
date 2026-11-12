'use client'

import Link from 'next/link'
import { Info } from 'lucide-react'
import { Panel } from '@/components/shared/panel'
import { formatNumber, formatPrice } from '@/lib/format'
export function ReceiveReceiptSummary({
  supplierName,
  reference,
  styleCode,
  lineCount,
  filledLines,
  units,
  totalValue,
  branchName,
  showCosts,
  problem,
  pending,
}: {
  supplierName: string
  reference: string
  styleCode: string
  branchName?: string
  lineCount: number
  filledLines: number
  units: number
  totalValue: number
  showCosts: boolean
  problem?: string | null
  pending: boolean
}) {
  const docLabel = reference.trim() || supplierName.trim() || "Not entered yet"

  return (
    <Panel title="Summary" description="The whole document posts to the server. Only the photo stays on this device.">
      <div className="panel-body stack">
        {styleCode ? (
          <p className="receive-style-badge tabular" aria-label="Model on this receipt">
            Model <strong>{styleCode}</strong>
          </p>
        ) : null}
        <dl className="dl-grid">
          {branchName ? (
            <>
              <dt>Arrived at</dt>
              <dd>{branchName}</dd>
            </>
          ) : null}
          <dt>Document</dt>
          <dd>{docLabel}</dd>
          <dt>Lines</dt>
          <dd className="tabular">
            {lineCount === 0 ? '' : filledLines === lineCount ? lineCount : `${filledLines} of ${lineCount}`}
          </dd>
          <dt>Pieces</dt>
          <dd className="tabular">{units > 0 ? formatNumber(units) : ''}</dd>
          {showCosts ? (
            <>
              <dt>Document value</dt>
              <dd className="tabular">{totalValue > 0 ? formatPrice(totalValue) : ''}</dd>
            </>
          ) : null}
        </dl>
        <p className="receive-summary-note muted">
          <Info size={14} aria-hidden="true" className="inline-icon" />
          One request, all or nothing. The server issues the receipt number and works out the total.
        </p>
        {problem ? (
          <p className="field-error" role="alert">
            {problem}
          </p>
        ) : null}
        <div className="receive-summary-actions">
          <Link href={'/stock-receipts'} className="btn btn-secondary">
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={Boolean(problem) || pending}>
            {pending ? 'Posting…' : 'Post receipt'}
          </button>
        </div>
      </div>
    </Panel>
  )
}
