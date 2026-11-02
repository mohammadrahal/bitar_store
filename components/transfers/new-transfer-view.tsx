'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useCatalogSync } from '@/hooks/use-stock'
import { PackageSearch } from 'lucide-react'
import { toast } from 'sonner'
import {
  TransferLinePicker,
  transferLinesSummary,
  type TransferLineDraft,
} from '@/components/transfers/transfer-line-picker'
import { EmptyState } from '@/components/shared/empty-state'
import { Field } from '@/components/shared/field'
import { LocationSelect } from '@/components/shared/location-select'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { useDefaultBranchId } from '@/hooks/use-branch-scope'
import { useBranches } from '@/hooks/use-branches'
import { useWarehouseId } from '@/hooks/use-inventory'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { usePermission } from '@/hooks/use-permission'
import { useCreateTransfer } from '@/hooks/use-transfers'
import { readDb } from '@/mocks/store'
import { WarehouseLinkNotice } from '@/components/shared/warehouse-link-notice'
import { WAREHOUSE_NOT_LINKED_MESSAGE } from '@/lib/warehouse-messages'
import { resolveWarehouseId } from '@/services/warehouse-link.service'
import type { Branch } from '@/types'

export function NewTransferView() {
  const router = useRouter()
  const create = useCreateTransfer()
  const idempotency = useIdempotencyKey()
  const { user, canDispatchTransfers, canReceiveTransfers, locationScoped } = usePermission()
  const requestMode = canReceiveTransfers() && !canDispatchTransfers()
  const defaultBranch = useDefaultBranchId()
  const receivingBranchId = user.branchId ?? user.branchIds[0] ?? defaultBranch
  const { data: branches } = useBranches()

  const [sourceBranchId, setSource] = useState('')
  const [destinationBranchId, setDestination] = useState(
    requestMode ? receivingBranchId : locationScoped ? defaultBranch : '',
  )
  const {
    data: warehouseId,
    isPending: warehousePending,
    refetch: refetchWarehouse,
  } = useWarehouseId(destinationBranchId || receivingBranchId)
  const [note, setNote] = useState('')
  const [pickerLines, setPickerLines] = useState<TransferLineDraft[]>([])
  const catalog = useCatalogSync()
  const catalogReady = catalog.data !== undefined

  useEffect(() => {
    if (branches) void refetchWarehouse()
  }, [branches, refetchWarehouse])

  useEffect(() => {
    if (warehouseId) setSource(warehouseId)
  }, [warehouseId])

  useEffect(() => {
    if (requestMode && receivingBranchId) setDestination(receivingBranchId)
  }, [requestMode, receivingBranchId])

  const findBranch = (branchId: string): Branch | undefined =>
    branches?.find((branch) => branch.id === branchId) ??
    readDb().branches.find((branch) => branch.id === branchId)

  const destinationBranch = useMemo(() => findBranch(destinationBranchId), [branches, destinationBranchId])

  const destinationLabel = destinationBranch?.name ?? (defaultBranch ? '…' : 'Your branch')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()

    let sourceId = sourceBranchId
    if (!sourceId && requestMode && destinationBranchId) {
      sourceId = (await resolveWarehouseId({ branchId: destinationBranchId })) ?? ''
      if (sourceId) setSource(sourceId)
    }
    if (!sourceId) {
      toast.error(WAREHOUSE_NOT_LINKED_MESSAGE)
      return
    }

    const parsed = pickerLines
      .map((line) => ({ skuId: line.skuId, quantity: line.quantity }))
      .filter((line) => line.skuId && line.quantity > 0)
    if (!destinationBranchId || parsed.length === 0) return

    create.mutate(
      {
        input: {
          sourceBranchId: sourceId,
          destinationBranchId,
          note: note.trim() ? note.trim() : undefined,
          lines: parsed,
        },
        idempotencyKey: idempotency.current(),
      },
      {
        onSuccess: (transfer) => {
          idempotency.reset()
          router.push(`/transfers/${transfer.id}`)
        },
      },
    )
  }

  const linePickerBranchId = requestMode ? destinationBranchId : sourceBranchId

  const submitBlocked =
    create.isPending || !destinationBranchId || !linePickerBranchId || pickerLines.length === 0

  return (
    <>
      <Link href="/transfers" className="back-link">
        {requestMode ? 'Back to your requests' : 'Back to transfers'}
      </Link>
      <PageHeader
        eyebrow={requestMode ? 'Inventory' : 'Warehouse'}
        title={requestMode ? 'Request replenishment' : 'Prepare transfer'}
        description={
          requestMode
            ? 'Tell the team which variants to send when your branch is low or sold out. Add each product and how many you need.'
            : 'Draft a shipment. Nothing moves until you send it from the transfer page.'
        }
      />

      {requestMode && (
        <p className="muted page-note" role="status">
          This is not a sale — you are asking for more stock at your branch. A manager or the warehouse prepares and
          sends it; nothing moves until they dispatch the shipment.
        </p>
      )}

      <form className="stack" onSubmit={submit}>
        <Panel title={requestMode ? 'Your branch' : 'Route'}>
          <div className="panel-body">
            {requestMode ? (
              <>
                <dl className="route-summary route-summary--single">
                  <div>
                    <dt>Restock at</dt>
                    <dd>{destinationLabel}</dd>
                  </div>
                </dl>
                <p className="muted field-hint replenishment-hint">
                  Availability in the picker reflects what you have on hand now — use it to spot sizes that are low.
                </p>
              </>
            ) : (
              <div className="form-grid">
                <Field label="From">
                  <LocationSelect
                    value={sourceBranchId}
                    onChange={setSource}
                    onlyAccessible
                    onlyFullAccess
                    exclude={destinationBranchId}
                  />
                </Field>
                <Field label="To">
                  <LocationSelect
                    value={destinationBranchId}
                    onChange={setDestination}
                    onlyAccessible
                    onlyFullAccess
                    exclude={sourceBranchId}
                  />
                </Field>
              </div>
            )}

            {!warehousePending && !sourceBranchId && requestMode && (
              <>
                <p className="muted field-hint">
                  You can still add products below. On submit we will look up the main warehouse again.
                </p>
                <WarehouseLinkNotice onRetry={() => void refetchWarehouse()} />
              </>
            )}

            <Field
              label={requestMode ? 'Details for the team' : 'Note'}
              hint={
                requestMode
                  ? 'Optional — e.g. which shelf is empty, an event this week, or sizes that sell fast.'
                  : 'Optional — saved on the transfer when you submit.'
              }
              className="full transfer-note-field"
            >
              <textarea
                className="input"
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                placeholder={requestMode ? 'What is running low and why you need more' : 'Shipment note'}
              />
            </Field>
          </div>
        </Panel>

        <Panel
          title={requestMode ? 'Products to restock' : 'Variants'}
          description={
            pickerLines.length > 0
              ? transferLinesSummary(pickerLines)
              : requestMode
                ? 'Search the catalog and add every variant that needs more units.'
                : 'Search the catalog and add each variant to ship. Pick the source location first so availability matches the warehouse.'
          }
        >
          {!destinationBranchId ? (
            <div className="panel-body">
              <EmptyState
                icon={PackageSearch}
                title="Branch required"
                description="Your account is not linked to a branch yet. Ask a manager to assign you to a store."
              />
            </div>
          ) : !catalogReady ? (
            <div className="panel-body muted">Loading catalog…</div>
          ) : (
            <div className="panel-body transfer-picker-panel">
              <TransferLinePicker
                branchId={linePickerBranchId}
                lines={pickerLines}
                onChange={setPickerLines}
                purpose={requestMode ? 'replenishment' : 'transfer'}
              />
            </div>
          )}
        </Panel>

        <div className="form-actions transfer-form-actions">
          {submitBlocked && pickerLines.length === 0 && (
            <p className="field-hint">
              {requestMode
                ? 'Add at least one product that is low or out of stock.'
                : 'Choose source and destination, then add at least one variant from the catalog.'}
            </p>
          )}
          <button type="submit" className="btn btn-primary" disabled={submitBlocked}>
            {requestMode ? 'Submit replenishment request' : 'Save draft'}
          </button>
        </div>
      </form>
    </>
  )
}
