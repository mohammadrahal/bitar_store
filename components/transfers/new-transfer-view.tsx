'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
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
  const { user, canDispatchTransfers, canReceiveTransfers, locationScoped, activeLocationId } = usePermission()
  const requestMode = canReceiveTransfers() && !canDispatchTransfers()
  const defaultBranch = useDefaultBranchId()
  const assignedBranchId =
    (locationScoped ? activeLocationId : null) ?? user.branchIds[0] ?? user.branchId ?? defaultBranch
  const { data: branches } = useBranches()

  const [sourceBranchId, setSource] = useState('')
  const [destinationBranchId, setDestination] = useState(
    requestMode ? assignedBranchId : locationScoped ? defaultBranch : '',
  )
  const warehouseLookupBranch = requestMode ? destinationBranchId || assignedBranchId : undefined
  const {
    data: warehouseId,
    isPending: warehousePending,
    refetch: refetchWarehouse,
  } = useWarehouseId(warehouseLookupBranch)
  const [note, setNote] = useState('')
  const [pickerLines, setPickerLines] = useState<TransferLineDraft[]>([])
  const catalog = useCatalogSync()
  const catalogReady = catalog.data !== undefined

  useEffect(() => {
    if (requestMode && branches) void refetchWarehouse()
  }, [requestMode, branches, refetchWarehouse])

  /* Replenishment requests always ship from the warehouse. Prepare-transfer
     must not auto-fill From — that was overwriting the manager's pick and
     showing warehouse availability (often 0 while stock sits at branches). */
  useEffect(() => {
    if (requestMode && warehouseId) setSource(warehouseId)
  }, [requestMode, warehouseId])

  /**
   * `?from=<branchId>` fills in the source once.
   *
   * It is how a just-posted receipt hands off: the stock arrived at the
   * warehouse and the next thing anyone does is send some of it to a shop, so
   * arriving here with From already set saves re-picking the location you were
   * looking at a moment ago. It runs once and never in request mode, where the
   * source is the warehouse by rule and not the caller's to choose.
   */
  const requestedSource = useSearchParams().get('from') ?? ''
  const sourceFromUrl = useRef(false)
  useEffect(() => {
    if (sourceFromUrl.current || requestMode || !requestedSource || sourceBranchId) return
    if (branches && !branches.some((branch) => branch.id === requestedSource)) return
    sourceFromUrl.current = true
    setSource(requestedSource)
  }, [requestedSource, requestMode, sourceBranchId, branches])

  useEffect(() => {
    if (!requestMode || !assignedBranchId) return
    if (!user.branchIds.includes(destinationBranchId)) setDestination(assignedBranchId)
  }, [requestMode, assignedBranchId, destinationBranchId, user.branchIds])

  const findBranch = (branchId: string): Branch | undefined =>
    branches?.find((branch) => branch.id === branchId) ??
    readDb().branches.find((branch) => branch.id === branchId)

  const destinationBranch = useMemo(() => findBranch(destinationBranchId), [branches, destinationBranchId])
  const sourceBranch = useMemo(() => findBranch(sourceBranchId), [branches, sourceBranchId])

  const destinationLabel = destinationBranch?.name ?? (defaultBranch ? '…' : 'Your branch')

  const linePickerBranchId = requestMode ? destinationBranchId : sourceBranchId
  const stockBranch = requestMode ? destinationBranch : sourceBranch
  const catalogGateId = requestMode ? destinationBranchId : sourceBranchId

  useEffect(() => {
    if (requestMode) return
    setPickerLines([])
  }, [sourceBranchId, requestMode])

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
                {user.branchIds.length > 1 ? (
                  <Field label="Restock at" hint="The warehouse sends to this branch. Must be a location you work at.">
                    <LocationSelect
                      value={destinationBranchId}
                      onChange={setDestination}
                      onlyAccessible
                      onlyFullAccess
                    />
                  </Field>
                ) : (
                  <dl className="route-summary route-summary--single">
                    <div>
                      <dt>Restock at</dt>
                      <dd>{destinationLabel}</dd>
                    </div>
                  </dl>
                )}
                <p className="muted field-hint replenishment-hint">
                  Availability in the picker reflects what you have on hand now — use it to spot sizes that are low.
                </p>
              </>
            ) : (
              <div className="form-grid">
                <Field
                  label="From"
                  hint="Available quantities in the list below are sellable stock at this location."
                >
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
                : 'Only products with stock at the From location appear below. Pick source first, then search or open a model.'
          }
        >
          {!catalogGateId ? (
            <div className="panel-body">
              <EmptyState
                icon={PackageSearch}
                title={requestMode ? 'Branch required' : 'Source location required'}
                description={
                  requestMode
                    ? 'Your account is not linked to a branch yet. Ask a manager to assign you to a store.'
                    : 'Choose the From location in Route first. Availability is read from that branch’s stock.'
                }
              />
            </div>
          ) : !catalogReady ? (
            <div className="panel-body muted">Loading catalog…</div>
          ) : (
            <div className="panel-body transfer-picker-panel">
              {stockBranch?.name && (
                <p className="invoice-picker-hint" role="status">
                  {requestMode
                    ? `On hand at ${stockBranch.name} (to spot sizes that are low).`
                    : `Showing only variants with stock at ${stockBranch.name}. Available counts are sellable units there.`}
                </p>
              )}
              {!requestMode && (
                <p className="invoice-picker-hint muted">
                  Nothing at this location yet? Stock arrives through <strong>Opening stock</strong> for a first
                  count, or <strong>Receive stock</strong> for a delivery.
                </p>
              )}
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
