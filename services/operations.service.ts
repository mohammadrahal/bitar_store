import { fromCents, toCents } from '@/lib/money'
import { paymentCents, salePaymentKind } from '@/lib/sale-payments'
import { fetchTodayBranchSales } from '@/services/today-branch-sales.service'
import type { BranchScope, OperationsSummary, TodayPaymentMix } from '@/types'

/** What the till took today, from `GET /sales` for the current business date. */
export async function getOperationsSummary(requested: BranchScope): Promise<OperationsSummary> {
  const snapshot = await fetchTodayBranchSales(requested)

  let todaySales = 0
  let todayCents = 0
  const cash = { sales: 0, cents: 0 }
  const whish = { sales: 0, cents: 0 }
  const split = { sales: 0, cents: 0, cashCents: 0, whishCents: 0 }

  for (const { sales } of snapshot.byBranch) {
    todaySales += sales.length
    for (const sale of sales) {
      const cents = toCents(Number(sale.total) || 0)
      todayCents += cents
      const payments = sale.payments ?? []
      const kind = salePaymentKind(payments)
      if (kind === 'split') {
        split.sales += 1
        split.cents += cents
        split.cashCents += paymentCents(payments, 'cash')
        split.whishCents += paymentCents(payments, 'whish')
      } else if (kind === 'whish') {
        whish.sales += 1
        whish.cents += cents
      } else {
        cash.sales += 1
        cash.cents += cents
      }
    }
  }

  const todayMix: TodayPaymentMix = {
    cash: { sales: cash.sales, amount: fromCents(cash.cents) },
    whish: { sales: whish.sales, amount: fromCents(whish.cents) },
    split: {
      sales: split.sales,
      amount: fromCents(split.cents),
      cashAmount: fromCents(split.cashCents),
      whishAmount: fromCents(split.whishCents),
    },
  }

  return { todaySales, todayRevenue: fromCents(todayCents), todayMix }
}
