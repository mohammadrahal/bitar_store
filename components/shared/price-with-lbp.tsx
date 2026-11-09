'use client'

import { formatLbp, formatPrice } from '@/lib/format'
import { usdToLbp } from '@/services/settings.service'
import { useExchangeRate } from '@/hooks/use-settings'

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
  const lbp = usdToLbp(usd, rateQuery.rate)
  const Tag = strong ? 'strong' : 'span'

  return (
    <span className={className ?? 'price-with-lbp'}>
      <Tag className="tabular">{formatPrice(usd)}</Tag>
      {lbp !== null && <small className="price-lbp tabular">≈ {formatLbp(lbp)}</small>}
    </span>
  )
}
