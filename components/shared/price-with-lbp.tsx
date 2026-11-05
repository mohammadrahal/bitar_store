'use client'

import { formatLbp, formatPrice } from '@/lib/format'
import { usdToLbpAmount } from '@/services/exchange-rate.service'
import { useExchangeRate } from '@/hooks/use-exchange-rate'

/** USD price with an optional LBP equivalent from the shared exchange rate. */
export function PriceWithLbp({
  usd,
  className,
  strong,
}: {
  usd: number
  className?: string
  strong?: boolean
}) {
  const rateQuery = useExchangeRate()
  const lbp = usdToLbpAmount(usd, rateQuery.data ?? null)
  const Tag = strong ? 'strong' : 'span'

  return (
    <span className={className ?? 'price-with-lbp'}>
      <Tag className="tabular">{formatPrice(usd)}</Tag>
      {lbp !== null && <small className="price-lbp tabular">≈ {formatLbp(lbp)}</small>}
    </span>
  )
}
