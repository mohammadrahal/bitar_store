'use client'

import { ArrowDownLeft, ArrowUpRight, Banknote, Smartphone } from 'lucide-react'
import { StatCard } from '@/components/dashboard/stat-cards'
import { priceOf } from '@/lib/api/map-catalog'
import { formatNumber, formatPrice } from '@/lib/format'
import type { ApiCashSessionSummary } from '@/lib/api/types'

/**
 * What is in the drawer, and the arithmetic it comes from.
 *
 * **Expected cash = opening + cash payments + cash in − cash out.** The parts
 * are on the face of the tiles rather than behind a disclosure, because the
 * figure someone is about to count against is one they have to be able to
 * check: a cashier who is $40 short needs to see that $40 went out as a
 * movement before they start recounting the notes.
 *
 * **Whish is reported, never added.** It is a tile of its own, labelled as not
 * being in the drawer, because a till total that quietly folded it in would
 * send every cashier hunting for money that was never there.
 */
export function CashTotalsTiles({ session }: { session: ApiCashSessionSummary }) {
  const { totals } = session
  const opening = priceOf(session.openingCash)
  const cashIn = priceOf(totals.cashIn)
  const cashOut = priceOf(totals.cashOut)
  const expected = priceOf(totals.expectedCash)

  return (
    <div className="stats-grid stats-grid--inventory">
      <StatCard
        label="Expected in the drawer"
        value={formatPrice(expected)}
        detail={`${formatPrice(opening)} opening + ${formatPrice(priceOf(totals.cashPayments))} cash sales + ${formatPrice(cashIn)} in − ${formatPrice(cashOut)} out`}
        icon={Banknote}
        highlight
      />
      <StatCard
        label="Cash taken in sales"
        value={formatPrice(priceOf(totals.cashPayments))}
        detail={`${formatNumber(totals.salesCount)} ${totals.salesCount === 1 ? 'sale' : 'sales'} · ${formatPrice(priceOf(totals.salesTotal))} rung up in all`}
        icon={ArrowDownLeft}
      />
      <StatCard
        label="Cash moved by hand"
        value={`${formatPrice(cashIn)} in · ${formatPrice(cashOut)} out`}
        detail="Float added, or cash taken out for an expense or a drop"
        icon={ArrowUpRight}
        alert={cashOut > 0}
      />
      <StatCard
        label="Whish"
        value={formatPrice(priceOf(totals.whishPayments))}
        detail="Not in the drawer. Whish never changes the cash you count"
        icon={Smartphone}
      />
    </div>
  )
}
