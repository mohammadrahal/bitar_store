'use client'

import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { MotionTbody, MotionTr } from '@/components/motion/motion-table'
import { EmptyState } from '@/components/shared/empty-state'
import { StockStatusPill } from '@/components/shared/status-pill'
import { ThresholdCell } from '@/components/stock/threshold-cell'
import type { LowStockRow } from '@/types'

export function LowStockTable({
  rows,
  showBranch,
  dataset,
}: {
  rows: LowStockRow[]
  showBranch: boolean
  /** Names the scope and page on screen, so the entrance plays once per set. */
  dataset?: string
}) {
  if (rows.length === 0) {
    return (
      <div className="panel-body">
        <EmptyState
          icon={CheckCircle2}
          title="Every variant is above its threshold"
          description="Nothing is low or out of stock in this scope right now."
        />
      </div>
    )
  }

  return (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">Variants at or below their low-stock threshold</caption>
        <thead>
          <tr>
            <th scope="col">Variant</th>
            {showBranch && <th scope="col">Branch</th>}
            <th scope="col" className="num">
              Available
            </th>
            <th scope="col" className="num">
              Threshold
            </th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <MotionTbody dataset={dataset}>
          {rows.map((row, index) => (
            <MotionTr key={`${row.variantId}-${row.branchId}`} index={index}>
              <td>
                <strong>
                  {row.productName} · {row.size} / {row.color}
                </strong>
                <small>
                  {row.sku} · {row.category}
                </small>
              </td>
              {showBranch && (
                <td>
                  <Link href={`/branches/${row.branchId}`} className="link-cell">
                    {row.branchName}
                  </Link>
                </td>
              )}
              <td className="num tabular">{row.quantity}</td>
              <td className="num">
                <ThresholdCell variantId={row.variantId} branchId={row.branchId} value={row.lowStockAt} />
              </td>
              <td>
                <StockStatusPill status={row.status} />
              </td>
            </MotionTr>
          ))}
        </MotionTbody>
      </table>
    </div>
  )
}
