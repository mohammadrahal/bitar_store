'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Field } from '@/components/shared/field'
import { Panel } from '@/components/shared/panel'
import { SearchInput } from '@/components/shared/search-input'
import { useLinkReturnExchange } from '@/hooks/use-returns'
import { useSalesHistory } from '@/hooks/use-sales-history'
import { priceOf } from '@/lib/api/map-catalog'
import { formatPrice, formatRelativeDateTime, todayAsDateInput } from '@/lib/format'
import { canLinkExchange } from '@/services/returns.service'
import type { ApiReturn } from '@/lib/api/types'

/**
 * An exchange: this return linked to the replacement sale.
 *
 * An exchange is **not** a third kind of transaction — it is a return plus an
 * ordinary new sale, linked so the net is on record. So the replacement is rung
 * up at the till as normal and only then named here. Nothing on this panel
 * pays the refund or releases the goods; both stay their own steps.
 *
 * The server refuses a sale from before the goods came in, one at another
 * branch, the sale being returned itself, and a sale already used as another
 * return's exchange. The reference is typed rather than picked from a list
 * because the cashier has the new receipt in their hand.
 */
export function ReturnExchangePanel({ entry }: { entry: ApiReturn }) {
  const link = useLinkReturnExchange()
  const [saleKey, setSaleKey] = useState('')

  /* Today's sales at this branch, newest first: enough to resolve a reference
     the cashier just rang up, which is the only case this panel serves. */
  const today = todayAsDateInput()
  const recent = useSalesHistory(
    { branchId: entry.receivingBranch.id, from: today, to: today, offset: 0, search: saleKey.trim() },
    { enabled: saleKey.trim().length >= 3 },
  )

  if (entry.exchange) {
    const { direction, net, saleReference, saleTotal, refundTotal } = entry.exchange
    return (
      <Panel
        title="Exchange"
        description={`Linked to sale ${saleReference}. The replacement cost ${formatPrice(
          priceOf(saleTotal),
        )} against a ${formatPrice(priceOf(refundTotal))} refund.`}
      >
        <div className="panel-body stack gap-sm">
          <p style={{ margin: 0 }}>
            {direction === 'customer_pays' ? (
              <>
                The customer pays <strong>{formatPrice(priceOf(net))}</strong> more.
              </>
            ) : direction === 'business_pays' ? (
              <>
                The shop owes <strong>{formatPrice(Math.abs(priceOf(net)))}</strong> on top of the
                refund.
              </>
            ) : (
              <>An even swap — nothing more to settle.</>
            )}
          </p>
          <p className="muted text-sm" style={{ margin: 0 }}>
            The refund above is still paid separately; linking the exchange did not settle it.
          </p>
        </div>
      </Panel>
    )
  }

  if (!canLinkExchange(entry)) return null

  const matches = recent.data?.sales ?? []

  return (
    <Panel
      title="Link an exchange (optional)"
      description="If the customer took something else instead, ring that sale up at the till first, then name it here to record the net."
    >
      <div className="panel-body stack gap-md" style={{ maxWidth: '32rem' }}>
        <Field
          label="The replacement sale"
          hint="Its receipt number. It has to be at this branch, rung up after the goods came in."
        >
          <SearchInput
            value={saleKey}
            onChange={setSaleKey}
            placeholder="S-00000013"
            aria-label="Find the replacement sale"
          />
        </Field>

        {saleKey.trim().length >= 3 && matches.length === 0 && !recent.isPending ? (
          <p className="muted text-sm" style={{ margin: 0 }}>
            No sale today at this branch matches that. Check the new receipt.
          </p>
        ) : null}

        {matches.map((sale) => (
          <div key={sale.id} className="form-actions" style={{ justifyContent: 'space-between' }}>
            <span>
              <strong>{sale.reference}</strong>{' '}
              <span className="muted text-sm">
                {formatPrice(priceOf(sale.total))} · {formatRelativeDateTime(sale.soldAt)}
              </span>
            </span>
            <button
              type="button"
              className="btn btn-primary"
              disabled={link.isPending}
              onClick={() => link.mutate({ id: entry.id, saleId: sale.id })}
            >
              {link.isPending ? 'Linking…' : 'Link this sale'}
            </button>
          </div>
        ))}

        <p className="muted text-sm" style={{ margin: 0 }}>
          Looking at today&rsquo;s sales at {entry.receivingBranch.name}. An older sale cannot be an
          exchange for goods that came back today.{' '}
          <Link href="/sales/new" className="text-link">
            Ring up the replacement
          </Link>
          .
        </p>
      </div>
    </Panel>
  )
}
