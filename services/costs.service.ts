import { getApiClient } from '@/lib/api'
import { statusOf } from '@/lib/errors'
import type { ApiProfitReport, ApiProfitRow, ApiSkuCost, ProfitReportParams } from '@/lib/api/types'

/**
 * Cost and profit, over `/costs`.
 *
 * Cost is an owner's figure: every route here is **admin or manager by role**,
 * and no permission grant opens it to an employee. `/costs/profit` additionally
 * needs `reports.financial`. A 403 from here is therefore the normal answer for
 * most accounts, not a fault — read it as "not for this account" and show
 * nothing rather than an error.
 *
 * **Costs carry four decimals** (`"9.5000"`), where prices carry two. Use
 * `costOf` and `costText` below rather than the money helpers, or a cost of
 * `12.3456` silently becomes `12.35` in a figure that is then multiplied by a
 * quantity.
 *
 * This is the server-side home of what `catalog-costs.service.ts` keeps in
 * `localStorage` per device. The two are not synchronised: a cost typed on one
 * laptop never reached another, which is the whole reason this endpoint exists.
 */

/** Parses a four-decimal cost string. `null` stays `null` — an unknown cost is not zero. */
export function costOf(text: string | null): number | null {
  if (text === null) return null
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

/** Sends a cost as text with four decimals, which is what the column holds. */
export function costText(value: number): string {
  return (Math.round(value * 10_000) / 10_000).toFixed(4)
}

/**
 * The cost used to price a supply invoice: the warehouse average, or the
 * catalog cost when the warehouse has none yet (opening stock).
 *
 * `null` means genuinely unknown, which is what makes an invoice line come back
 * as `priceSource: 'missing'` priced at 0.00.
 */
export function effectiveCost(cost: ApiSkuCost): number | null {
  return costOf(cost.warehouseAverageCost) ?? costOf(cost.catalogCost)
}

/**
 * `GET /costs/skus/:id`. `null` when this account may not see costs, so a
 * screen can simply omit the column instead of handling an error.
 */
export async function getSkuCost(skuId: string): Promise<ApiSkuCost | null> {
  try {
    return await getApiClient().getSkuCost(skuId)
  } catch (error) {
    if (statusOf(error) === 403) return null
    throw error
  }
}

/**
 * `PUT /costs/skus/:id`. Manager or admin. Pass `null` to clear it.
 *
 * Clearing removes only the typed catalog cost; the warehouse average is
 * computed from the receipts and cannot be set or cleared from here.
 */
export async function setSkuCost(skuId: string, unitCost: number | null): Promise<ApiSkuCost> {
  if (unitCost !== null && unitCost < 0) throw new Error('A cost cannot be negative.')
  if (unitCost !== null && unitCost > 100_000) throw new Error('A cost above 100,000.00 is refused.')
  return getApiClient().setSkuCost(skuId, { unitCost: unitCost === null ? null : costText(unitCost) })
}

/** `GET /costs/profit`. `null` when the account may not see costs or financial reports. */
export async function getProfitReport(params: ProfitReportParams = {}): Promise<ApiProfitReport | null> {
  try {
    return await getApiClient().getProfitReport(params)
  } catch (error) {
    if (statusOf(error) === 403) return null
    throw error
  }
}

/**
 * Revenue whose cost was never recorded, as a share of revenue.
 *
 * This is the figure that says how much to trust `profit`. At 0 the margin is
 * the whole picture; at 0.4, two fifths of what was sold has no cost behind it
 * and the stated profit covers only the rest. A screen that shows profit
 * without this is showing a number nobody can act on.
 */
export function unknownCostShare(row: ApiProfitRow | ApiProfitReport['totals']): number {
  const revenue = Number(row.revenue)
  if (!Number.isFinite(revenue) || revenue <= 0) return 0
  return Number(row.unknownCostRevenue) / revenue
}

/** Margin on what customers kept, as a fraction of net revenue. `null` when nothing was sold. */
export function netMargin(row: ApiProfitRow | ApiProfitReport['totals']): number | null {
  const net = Number(row.netRevenue)
  if (!Number.isFinite(net) || net === 0) return null
  return Number(row.netProfit) / net
}
