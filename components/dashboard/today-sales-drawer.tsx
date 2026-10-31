'use client'

import Link from 'next/link'
import { Drawer } from '@/components/shared/drawer'
import { countOf } from '@/components/dashboard/stat-cards'
import { formatPrice } from '@/lib/format'
import type { TodayPaymentMix } from '@/types'

export function TodaySalesDrawer({
  revenue,
  sales,
  mix,
  canViewList,
  onClose,
}: {
  revenue: number
  sales: number
  mix: TodayPaymentMix
  canViewList: boolean
  onClose: () => void
}) {
  return (
    <Drawer
      eyebrow="Today"
      title="Today's sales"
      description={`${formatPrice(revenue)} · ${countOf(sales, 'sale')}`}
      onClose={onClose}
      footer={
        <>
          {canViewList && (
            <Link href="/sales/b2c" className="btn btn-secondary" onClick={onClose}>
              View sales
            </Link>
          )}
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <div className="table-wrap">
        <table className="card-table">
          <caption className="sr-only">How today&apos;s sales were paid</caption>
          <thead>
            <tr>
              <th scope="col">Method</th>
              <th scope="col" className="num">
                Sales
              </th>
              <th scope="col" className="num">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="card-title">Cash</td>
              <td className="num tabular">{mix.cash.sales}</td>
              <td className="num tabular">{formatPrice(mix.cash.amount)}</td>
            </tr>
            <tr>
              <td className="card-title">Whish</td>
              <td className="num tabular">{mix.whish.sales}</td>
              <td className="num tabular">{formatPrice(mix.whish.amount)}</td>
            </tr>
            <tr>
              <td className="card-title">
                Both
                {mix.split.sales > 0 && (
                  <small>
                    Cash {formatPrice(mix.split.cashAmount)} · Whish {formatPrice(mix.split.whishAmount)}
                  </small>
                )}
              </td>
              <td className="num tabular">{mix.split.sales}</td>
              <td className="num tabular">{formatPrice(mix.split.amount)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Drawer>
  )
}
