import { delay } from '@/lib/delay'
import { fromCents, toCents } from '@/lib/money'
import { paymentCents, salePaymentKind } from '@/lib/sale-payments'
import { readDb } from '@/mocks/store'
import { visibleBranchIds, visibleScope } from '@/services/mock-ledger'
import { listSales } from '@/services/sales.service'
import { ALL_BRANCHES, type BranchScope, type OperationsSummary, type TodayPaymentMix } from '@/types'

const SALES_PAGE = 200

/** What the till took today, from `GET /sales` for the current business date. */
export async function getOperationsSummary(requested: BranchScope): Promise<OperationsSummary> {
  const db = readDb()
  const scope = visibleScope(requested)
  const visible = new Set(visibleBranchIds(db))
  const inScope = (branchId: string) => visible.has(branchId) && (scope === ALL_BRANCHES || branchId === scope)

  let todaySales = 0
  let todayCents = 0
  const cash = { sales: 0, cents: 0 }
  const whish = { sales: 0, cents: 0 }
  const split = { sales: 0, cents: 0, cashCents: 0, whishCents: 0 }

  for (const branch of db.branches.filter((branch) => inScope(branch.id))) {
    const { sales } = await listSales({ branchId: branch.id, limit: SALES_PAGE })
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

  return delay({ todaySales, todayRevenue: fromCents(todayCents), todayMix })
}
