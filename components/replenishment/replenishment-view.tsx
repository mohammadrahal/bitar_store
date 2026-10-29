'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { ReplenishmentRequestForm } from '@/components/replenishment/request-form'
import { ReplenishmentRequestsPanel } from '@/components/replenishment/requests-panel'
import { SuggestionsPanel } from '@/components/replenishment/suggestions-panel'
import { PageHeader } from '@/components/shared/page-header'
import { PreviewBadge } from '@/components/shared/preview-badge'
import { useBranchScope, useDefaultBranchId } from '@/hooks/use-branch-scope'
import { usePermission } from '@/hooks/use-permission'
import { isEnabled } from '@/lib/features'

/**
 * BL-05: a location asks for stock and an owner role decides. The suggested
 * quantities are future work, so they only appear with the
 * `replenishmentSuggestions` flag on; the low-stock threshold is an indicator
 * and never raises a request by itself.
 */
export function ReplenishmentView() {
  const scope = useBranchScope()
  const defaultBranch = useDefaultBranchId()
  const { can } = usePermission()
  const [requesting, setRequesting] = useState(false)

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Replenishment"
        description="What each location has asked the warehouse for, and what was approved."
        actions={
          can('movements.request') ? (
            <button type="button" className="btn btn-primary" onClick={() => setRequesting(true)}>
              <Plus size={16} aria-hidden="true" />
              Request stock
            </button>
          ) : null
        }
      />

      <PreviewBadge feature="Replenishment requests" />

      <ReplenishmentRequestsPanel scope={scope} />

      {isEnabled('replenishmentSuggestions') && <SuggestionsPanel scope={scope} />}

      {requesting && (
        <ReplenishmentRequestForm defaultBranchId={defaultBranch} onClose={() => setRequesting(false)} />
      )}
    </>
  )
}
