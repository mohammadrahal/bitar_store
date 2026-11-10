'use client'

import { formatLbp, formatPrice } from '@/lib/format'
import { usdToLbp } from '@/services/settings.service'
import { useExchangeRate } from '@/hooks/use-settings'

/** USD price with an optional LBP equivalent from the shared exchange rate. */
export function PriceWithLbp({
  usd,
  className,
  strong,
  /** Invoice sale rate; falls back to store settings when omitted. */
  exchangeRateUsdLbp,
  /** Exact pounds from the API (e.g. invoice `totalLbp`) instead of converting `usd`. */
  lbpAmount,
}: {
  usd: number
  className?: string
  strong?: boolean
  exchangeRateUsdLbp?: number | null
  lbpAmount?: number | null
}) {
  const rateQuery = useExchangeRate()
  const rate = exchangeRateUsdLbp ?? rateQuery.rate
  const lbp = lbpAmount ?? usdToLbp(usd, rate)
  const Tag = strong ? 'strong' : 'span'

  return (
    <span className={className ?? 'price-with-lbp'}>
      <Tag className="tabular">{formatPrice(usd)}</Tag>
      {lbp !== null && lbp > 0 && usd > 0 && (
        <small className="price-lbp tabular">≈ {formatLbp(lbp)}</small>
      )}
    </span>
  )
}
