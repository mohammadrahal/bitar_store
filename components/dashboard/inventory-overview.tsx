'use client'

import { FinancialInventoryOverview } from '@/components/dashboard/financial-inventory-overview'
import { LegacyInventoryOverview } from '@/components/dashboard/legacy-inventory-overview'
import { usePermission } from '@/hooks/use-permission'
import type { BranchScope } from '@/types'

export function InventoryOverview({
  scope,
  mode,
  children,
}: {
  scope: BranchScope
  mode: 'network' | 'branch'
  children?: React.ReactNode
}) {
  const { canViewFinancialReports } = usePermission()
  const body = { scope, mode, children }

  if (canViewFinancialReports()) return <FinancialInventoryOverview {...body} />
  return <LegacyInventoryOverview {...body} />
}
