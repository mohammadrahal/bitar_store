'use client'

import { useState } from 'react'
import { CountTab } from '@/components/stock-control/count-tab'
import { DisposalTab } from '@/components/stock-control/disposal-tab'
import { HoldsTab } from '@/components/stock-control/holds-tab'
import { Field } from '@/components/shared/field'
import { LocationSelect } from '@/components/shared/location-select'
import { PageHeader } from '@/components/shared/page-header'
import { PreviewBadge } from '@/components/shared/preview-badge'
import { useDefaultBranchId } from '@/hooks/use-branch-scope'
import { usePermission } from '@/hooks/use-permission'

type Tab = 'holds' | 'count' | 'disposal'

export function StockControlView() {
  const { can, locationScoped } = usePermission()
  const defaultBranch = useDefaultBranchId()
  const [branchChoice, setBranch] = useState<string | null>(null)
  const branchId = branchChoice ?? defaultBranch

  const tabs: { id: Tab; label: string; visible: boolean }[] = [
    { id: 'holds', label: 'Holds', visible: true },
    { id: 'count', label: 'Physical count', visible: can('counts.apply') || can('counts.enter') },
    { id: 'disposal', label: 'Disposal', visible: can('stock.dispose') },
  ]
  const visibleTabs = tabs.filter((tab) => tab.visible)
  const [tab, setTab] = useState<Tab>('holds')

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Stock control"
        description="Keep damaged or doubtful units out of sale, check the shelf against the system, and write off what cannot be sold."
        actions={
          !locationScoped && (
            <Field label="Location" className="inline-field">
              <LocationSelect value={branchId} onChange={setBranch} onlyAccessible />
            </Field>
          )
        }
      />

      <PreviewBadge feature="Holds, physical counts and disposal" />
      <div className="segmented" role="tablist" aria-label="Stock control">
        {visibleTabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            id={`tab-${entry.id}`}
            aria-selected={tab === entry.id}
            aria-controls={`panel-${entry.id}`}
            className={tab === entry.id ? 'active' : ''}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="stack tab-panel">
        {tab === 'holds' && <HoldsTab branchId={branchId} />}
        {tab === 'count' && <CountTab branchId={branchId} />}
        {tab === 'disposal' && <DisposalTab branchId={branchId} />}
      </div>
    </>
  )
}
