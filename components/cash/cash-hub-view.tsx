'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Banknote, History } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { CashDrawerView } from '@/components/cash/cash-drawer-view'
import { CashShiftsView } from '@/components/cash/cash-shifts-view'
import { useDefaultBranchId, useListBranchFilter } from '@/hooks/use-branch-scope'
import { usePermission } from '@/hooks/use-permission'
import { cashHubHref, parseCashHubSection, type CashHubSection } from '@/lib/cash-hub'
import { cn } from '@/lib/utils'

const SECTION_COPY: Record<CashHubSection, { title: string; description: string }> = {
  drawer: {
    title: 'Register shifts & cash drawer',
    description:
      'Reconcile physical cash, record movements and handovers, and close the session with an audit. Totals come from the open cash session on the server.',
  },
  shifts: {
    title: 'Shifts',
    description:
      'Every drawer that has been opened. A count that did not match stays flagged until a manager signs it off.',
  },
}

/**
 * The till's cash in one screen: today's drawer, and the record of past shifts.
 *
 * Two tabs rather than two routes, because the same person does both — a
 * manager closing up looks at the count in front of them and then at last
 * week's to see whether this till is always short.
 *
 * The branch is held here and shared by both tabs: picking a branch to inspect
 * a shift and then finding the drawer tab back on a different one is how a
 * count gets read against the wrong till.
 */
export function CashHubView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { canAny } = usePermission()
  const defaultBranch = useDefaultBranchId()
  const scopedBranch = useListBranchFilter()
  const [branchId, setBranchId] = useState<string | null>(null)

  const mayUseDrawer = canAny(['cash.open', 'cash.accept', 'cash.close', 'cash.move'])

  const requested = parseCashHubSection(searchParams.get('section'))
  const section: CashHubSection = useMemo(() => {
    if (requested) return requested
    return mayUseDrawer ? 'drawer' : 'shifts'
  }, [requested, mayUseDrawer])

  useEffect(() => {
    if (searchParams.get('section') === section) return
    const next = new URLSearchParams(searchParams.toString())
    next.set('section', section)
    router.replace(`/cash?${next.toString()}`, { scroll: false })
  }, [section, router, searchParams])

  /* The drawer needs a concrete branch; the shift list accepts "every branch"
     as an empty string. `null` means "not chosen on this screen yet" and falls
     back to the branch in view — which for an employee is their own location,
     so their shift list is not silently widened to the whole network. */
  const drawerBranch = branchId ?? defaultBranch
  const listBranch = branchId ?? scopedBranch

  const copy = SECTION_COPY[section]
  const tabs: { id: CashHubSection; label: string; icon: typeof Banknote }[] = [
    { id: 'drawer', label: 'Drawer', icon: Banknote },
    { id: 'shifts', label: 'Shifts', icon: History },
  ]

  return (
    <div className={section === 'drawer' ? 'cash-hub-shell' : undefined}>
      {section === 'shifts' ? (
        <PageHeader eyebrow="Till" title={copy.title} description={copy.description} />
      ) : null}

      <div className="inventory-hub-tabs cash-hub-tabs" role="tablist" aria-label="Cash sections">
        {tabs.map(({ id, label, icon: Icon }) => {
          const selected = id === section
          return (
            <Link
              key={id}
              href={cashHubHref(id)}
              scroll={false}
              role="tab"
              aria-selected={selected}
              className={cn('inventory-hub-tab', selected && 'inventory-hub-tab--active')}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </Link>
          )
        })}
      </div>

      <div role="tabpanel" id={`cash-section-${section}`} className="stack">
        {section === 'drawer' ? (
          <CashDrawerView branchId={drawerBranch} onBranchChange={setBranchId} />
        ) : (
          <CashShiftsView branchId={listBranch} onBranchChange={setBranchId} />
        )}
      </div>
    </div>
  )
}
