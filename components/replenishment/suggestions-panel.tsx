'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { PackageCheck } from 'lucide-react'
import { ReplenishmentTable } from '@/components/replenishment/replenishment-table'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { useWarehouseId } from '@/hooks/use-inventory'
import { useReplenishment } from '@/hooks/use-stock-control'
import { useCreateTransfer } from '@/hooks/use-transfers'
import type { BranchScope, ReplenishmentRow } from '@/types'

const rowKey = (row: ReplenishmentRow) => `${row.branchId}|${row.variantId}`

/**
 * Suggested quantities, worked out from each threshold and what the warehouse
 * can spare. BL-05 marks this future, so it sits behind the
 * `replenishmentSuggestions` flag; a threshold never raises a request by
 * itself, it only colours the indicator.
 */
export function SuggestionsPanel({ scope }: { scope: BranchScope }) {
  const router = useRouter()
  const { data: warehouseId } = useWarehouseId()
  const { data: rows, isPending, isError, error, refetch } = useReplenishment(scope)
  const create = useCreateTransfer()
  const idempotency = useIdempotencyKey()
  const [picked, setPicked] = useState<Record<string, number>>({})
  const [sending, setSending] = useState(false)

  const selected = (rows ?? []).filter((row) => (picked[rowKey(row)] ?? 0) > 0)
  const branches = [...new Set(selected.map((row) => row.branchId))]

  const submit = async () => {
    if (!warehouseId) return
    setSending(true)
    try {
      let lastId = ''
      for (const branchId of branches) {
        const lines = selected
          .filter((row) => row.branchId === branchId)
          .map((row) => ({ variantId: row.variantId, quantity: picked[rowKey(row)] ?? 0 }))
        const transfer = await create.mutateAsync({
          input: { fromBranchId: warehouseId, toBranchId: branchId, note: 'Replenishment', lines },
          key: `${idempotency.current()}:${branchId}`,
        })
        lastId = transfer.id
      }
      idempotency.reset()
      setPicked({})
      router.push(branches.length === 1 ? `/transfers/${lastId}` : '/transfers')
    } catch {
      // Toasted by the hook; requests already created replay on retry with the same keys.
    } finally {
      setSending(false)
    }
  }

  return (
    <Panel
      title="Suggestions"
      description={isPending ? 'Loading…' : `${rows?.length ?? 0} below threshold`}
      actions={
        <button
          type="button"
          className="btn btn-secondary"
          disabled={selected.length === 0 || sending || !warehouseId}
          onClick={() => void submit()}
        >
          {sending
            ? 'Requesting…'
            : branches.length === 0
              ? 'Request transfers'
              : `Request ${branches.length} ${branches.length === 1 ? 'transfer' : 'transfers'}`}
        </button>
      }
    >
      {isPending ? (
        <div className="panel-body">
          <Skeleton rows={3} stats={0} />
        </div>
      ) : isError ? (
        <div className="panel-body">
          <ErrorState title="Could not load suggestions" error={error} onRetry={() => void refetch()} />
        </div>
      ) : !warehouseId ? (
        <div className="panel-body">
          <EmptyState
            icon={PackageCheck}
            title="No warehouse set"
            description="A super admin needs to mark one location as the main warehouse on the Branches page."
          />
        </div>
      ) : rows.length === 0 ? (
        <div className="panel-body">
          <EmptyState
            icon={PackageCheck}
            title="Nothing to replenish"
            description="Every location is above its low-stock threshold, counting what is already in transit."
          />
        </div>
      ) : (
        <ReplenishmentTable
          rows={rows}
          picked={picked}
          keyOf={rowKey}
          onChange={(key, quantity) => setPicked((current) => ({ ...current, [key]: quantity }))}
        />
      )}
    </Panel>
  )
}
