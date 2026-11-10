'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ListChecks, Undo2 } from 'lucide-react'
import { Field } from '@/components/shared/field'
import { LocationSelect } from '@/components/shared/location-select'
import { PageHeader } from '@/components/shared/page-header'
import { ReceiveReturnPanel } from '@/components/returns/receive-return-panel'
import { ReturnsListView } from '@/components/returns/returns-list-view'
import { useAllowPageBranchFilter, useDefaultBranchId, useListBranchFilter } from '@/hooks/use-branch-scope'
import { usePermission } from '@/hooks/use-permission'
import { parseReturnsHubSection, returnsHubHref, type ReturnsHubSection } from '@/lib/returns-hub'
import { cn } from '@/lib/utils'

const SECTION_COPY: Record<ReturnsHubSection, { title: string; description: string }> = {
  desk: {
    title: 'Returns',
    description:
      'Take goods back at the counter. Find the sale on the receipt, record what is coming back and why. No stock moves until a manager approves it.',
  },
  record: {
    title: 'Returns',
    description:
      'Everything that has come back, and what is still owed on it. Approving, releasing and refunding happen on each return.',
  },
}

/**
 * Where a return is done.
 *
 * Two tabs, one route. **Take a return** is the counter: it is the default
 * because that is the time-critical act, with a customer standing there. **All
 * returns** is the follow-up, where a manager decides and the money is paid.
 *
 * The branch is held here and shared by both tabs, as on the cash screen:
 * taking goods in at one branch and then reading the list of another is how a
 * return gets chased at the wrong counter. The desk needs a concrete branch —
 * goods arrive somewhere — while the list accepts "every branch".
 */
export function ReturnsHubView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { canRecordReturns, canDecideReturns, canRefundReturns, locationScoped } = usePermission()
  const allowBranchPicker = useAllowPageBranchFilter()
  const defaultBranch = useDefaultBranchId()
  const scopedBranch = useListBranchFilter()
  const [branchId, setBranchId] = useState<string | null>(null)

  const mayTakeReturns = canRecordReturns()

  const requested = parseReturnsHubSection(searchParams.get('section'))
  const section: ReturnsHubSection = useMemo(() => {
    if (requested) return requested
    /* Someone who can only decide or pay is not standing at the counter: the
       record is their screen, and the desk would just refuse them. */
    return mayTakeReturns ? 'desk' : 'record'
  }, [requested, mayTakeReturns])

  useEffect(() => {
    if (searchParams.get('section') === section) return
    const next = new URLSearchParams(searchParams.toString())
    next.set('section', section)
    router.replace(`/returns?${next.toString()}`, { scroll: false })
  }, [section, router, searchParams])

  const deskBranch = branchId ?? defaultBranch
  const listBranch = branchId ?? scopedBranch

  const copy = SECTION_COPY[section]
  const tabs: { id: ReturnsHubSection; label: string; icon: typeof Undo2 }[] = [
    { id: 'desk', label: 'Take a return', icon: Undo2 },
    { id: 'record', label: 'All returns', icon: ListChecks },
  ]

  return (
    <>
      <PageHeader eyebrow="Counter" title={copy.title} description={copy.description} />

      <div className="inventory-hub-tabs" role="tablist" aria-label="Returns sections">
        {tabs.map(({ id, label, icon: Icon }) => {
          const selected = id === section
          return (
            <Link
              key={id}
              href={returnsHubHref(id)}
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

      <div role="tabpanel" id={`returns-section-${section}`} className="stack">
        {section === 'desk' ? (
          <>
            {allowBranchPicker && !locationScoped ? (
              <div className="toolbar">
                <Field
                  label="Branch taking the goods"
                  hint="Where the customer is handing them in."
                  className="toolbar-field"
                >
                  <LocationSelect value={deskBranch} onChange={setBranchId} onlyAccessible />
                </Field>
              </div>
            ) : null}
            <ReceiveReturnPanel branchId={deskBranch} />
            {!canDecideReturns() && mayTakeReturns ? (
              <p className="section-note muted">
                A manager approves or rejects what you take in, and the refund is paid after that.
                {canRefundReturns() ? ' You can pay a refund once it is approved.' : ''}
              </p>
            ) : null}
          </>
        ) : (
          <ReturnsListView branchId={listBranch} onBranchChange={setBranchId} />
        )}
      </div>
    </>
  )
}
