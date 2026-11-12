'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useCatalogSync } from '@/hooks/use-stock'
import { ArrowLeft, Check, MapPin, PackageSearch } from 'lucide-react'
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
import { useInventory, useWarehouseId } from '@/hooks/use-inventory'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { usePermission } from '@/hooks/use-permission'
import { useStockHealth } from '@/hooks/use-stock-health'
import { useCreateTransfer, useDispatchTransfer } from '@/hooks/use-transfers'
import { sumBalances } from '@/lib/balances'
import { formatNumber } from '@/lib/format'
import { inventoryHubHref } from '@/lib/inventory-hub'
import { readDb } from '@/mocks/store'
import { WarehouseLinkNotice } from '@/components/shared/warehouse-link-notice'
import { WAREHOUSE_NOT_LINKED_MESSAGE } from '@/lib/warehouse-messages'
import { resolveWarehouseId } from '@/services/warehouse-link.service'
import { useUIStore } from '@/store/ui-store'
import type { Branch } from '@/types'

const FORM_ID = 'prepare-transfer-form'

export function NewTransferView() {
  const router = useRouter()
  const create = useCreateTransfer()
  const idempotency = useIdempotencyKey()
  const dispatchKey = useIdempotencyKey()
  const dispatchTransfer = useDispatchTransfer()
  const {
    user: permissionUser,
    canAccessLocation,
    locationAccess,
    canDispatchTransfers,
    canReceiveTransfers,
    locationScoped,
    activeLocationId,
  } = usePermission()
  const requestMode = canReceiveTransfers() && !canDispatchTransfers()
  const defaultBranch = useDefaultBranchId()
  const assignedBranchId =
    (locationScoped ? activeLocationId : null) ?? permissionUser.branchIds[0] ?? permissionUser.branchId ?? defaultBranch
  const { data: branches } = useBranches()
  const lastDestinationId = useUIStore((state) => state.lastTransferDestinationId)
  const rememberDestination = useUIStore((state) => state.setLastTransferDestinationId)

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

  useEffect(() => {
    if (requestMode && warehouseId) setSource(warehouseId)
  }, [requestMode, warehouseId])

  const requestedSource = useSearchParams().get('from') ?? ''
  const sourceFromUrl = useRef(false)
  useEffect(() => {
    if (sourceFromUrl.current || requestMode || !requestedSource || sourceBranchId) return
    if (branches && !branches.some((branch) => branch.id === requestedSource)) return
    sourceFromUrl.current = true
    setSource(requestedSource)
  }, [requestedSource, requestMode, sourceBranchId, branches])

  /* The business is warehouse-first: nearly every transfer leaves the main
     warehouse. So From starts there, the way "Arrived at" does on a receipt,
     instead of starting empty and asking the same question on every shipment.
     Offered once, only to someone who may act for the warehouse, and never
     when the warehouse is already the destination. The select stays, for the
     shop-to-shop move that is the exception. */
  const sourceDefaulted = useRef(false)
  useEffect(() => {
    if (sourceDefaulted.current || requestMode || requestedSource || sourceBranchId || !warehouseId) return
    sourceDefaulted.current = true
    if (warehouseId === destinationBranchId) return
    if (locationAccess(warehouseId) !== 'full') return
    setSource(warehouseId)
  }, [requestMode, requestedSource, sourceBranchId, warehouseId, destinationBranchId, locationAccess])

  /* The destination used last on this device, which the quick-send drawer
     already remembers. A hint, not a lock: it is skipped when it would point
     the route back at its own source. */
  const destinationDefaulted = useRef(false)
  useEffect(() => {
    if (destinationDefaulted.current || requestMode || destinationBranchId || !lastDestinationId) return
    /* Wait for the source to settle first, or the two defaults can collide. */
    if (!sourceBranchId && warehousePending && !requestedSource) return
    destinationDefaulted.current = true
    if (lastDestinationId === sourceBranchId) return
    /* From is about to become the warehouse in this same pass. */
    if (!sourceBranchId && lastDestinationId === warehouseId) return
    if (locationAccess(lastDestinationId) !== 'full') return
    if (branches && !branches.some((branch) => branch.id === lastDestinationId && branch.isActive)) return
    setDestination(lastDestinationId)
  }, [
    requestMode,
    destinationBranchId,
    lastDestinationId,
    sourceBranchId,
    warehousePending,
    warehouseId,
    requestedSource,
    locationAccess,
    branches,
  ])

  useEffect(() => {
    if (!requestMode || !assignedBranchId) return
    if (!permissionUser.branchIds.includes(destinationBranchId)) setDestination(assignedBranchId)
  }, [requestMode, assignedBranchId, destinationBranchId, permissionUser.branchIds])

  const findBranch = (branchId: string): Branch | undefined =>
    branches?.find((branch) => branch.id === branchId) ??
    readDb().branches.find((branch) => branch.id === branchId)

  const destinationBranch = useMemo(() => findBranch(destinationBranchId), [branches, destinationBranchId])
  const sourceBranch = useMemo(() => findBranch(sourceBranchId), [branches, sourceBranchId])

  const destinationLabel = destinationBranch?.name ?? (defaultBranch ? '…' : 'Your branch')

  const linePickerBranchId = requestMode ? destinationBranchId : sourceBranchId
  const stockBranch = requestMode ? destinationBranch : sourceBranch
  const catalogGateId = requestMode ? destinationBranchId : sourceBranchId

  const sourceStockQuery = useInventory({
    scope: sourceBranchId || defaultBranch,
    filter: 'all',
    search: '',
  })
  const sourceSellable =
    sourceBranchId && sourceStockQuery.data ? sumBalances(sourceStockQuery.data).available : null

  const destHealth = useStockHealth(destinationBranchId || defaultBranch)
  const destLow =
    destinationBranchId && destHealth.data?.minimumsKnown ? destHealth.data.lowStock : null

  useEffect(() => {
    if (requestMode) return
    setPickerLines([])
  }, [sourceBranchId, requestMode])

  const submitWith = async (mode: 'draft' | 'send') => {
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

    let transferId = ''
    try {
      const transfer = await create.mutateAsync({
        input: {
          sourceBranchId: sourceId,
          destinationBranchId,
          note: note.trim() ? note.trim() : undefined,
          lines: parsed,
        },
        idempotencyKey: idempotency.current(),
      })
      transferId = transfer.id
      idempotency.reset()
    } catch {
      return
    }

    if (!requestMode) rememberDestination(destinationBranchId)

    if (mode === 'send') {
      try {
        await dispatchTransfer.mutateAsync({ id: transferId, idempotencyKey: dispatchKey.current() })
        dispatchKey.reset()
      } catch {
        /* Draft exists; detail screen has Send. */
      }
    }

    router.push(`/transfers/${transferId}`)
  }

  const busy = create.isPending || dispatchTransfer.isPending
  const submitBlocked = busy || !destinationBranchId || !linePickerBranchId || pickerLines.length === 0
  const totalUnits = pickerLines.reduce((sum, line) => sum + line.quantity, 0)
  const pieces = `${formatNumber(totalUnits)} ${totalUnits === 1 ? 'piece' : 'pieces'}`

  const canSendNow =
    !requestMode && canDispatchTransfers() && Boolean(sourceBranchId) && canAccessLocation(sourceBranchId)

  /* The button says what it does and where the stock goes. It used to read
     "Review & submit transfer" in the header and "Authorize & submit transfer"
     in the footer for the same one-click send, with no review step behind
     either. A dispatched transfer cannot be cancelled, so the label is the
     review: the count and the destination, read before the click. */
  const primaryLabel = canSendNow
    ? busy
      ? 'Sending…'
      : totalUnits > 0 && destinationBranch
        ? `Send ${pieces} to ${destinationBranch.name}`
        : 'Send now'
    : busy
      ? 'Saving…'
      : requestMode
        ? 'Submit request'
        : 'Save as draft'

  const listHref = inventoryHubHref(requestMode ? 'receiving' : 'transfers')

  return (
    <div className="prepare-transfer-page">
      <Link href={listHref} className="back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        {requestMode ? 'Back to your requests' : 'Back to transfers'}
      </Link>

      <PageHeader
        eyebrow={requestMode ? 'Replenishment' : 'Transfers'}
        title={requestMode ? 'Request replenishment' : 'Prepare transfer'}
        description={
          requestMode
            ? 'Tell the team which variants to send when your branch is low or sold out. Nothing moves until the warehouse dispatches.'
            : 'Choose the route and the pieces. Nothing leaves the source until the transfer is sent.'
        }
      />

      {requestMode && (
        <p className="muted page-note" role="status">
          This is not a sale. You are asking for more stock at your branch; a manager or the warehouse prepares and
          sends it.
        </p>
      )}

      <form
        id={FORM_ID}
        className="stack prepare-transfer-form"
        onSubmit={(event) => {
          event.preventDefault()
          void submitWith(canSendNow ? 'send' : 'draft')
        }}
      >
        <Panel title={requestMode ? '1. Your branch' : '1. Route'} className="prepare-transfer-section">
          <div className="panel-body prepare-transfer-route-body">
            {requestMode ? (
              <>
                {permissionUser.branchIds.length > 1 ? (
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
              </>
            ) : (
              <div className="prepare-transfer-route-grid">
                <div className="prepare-transfer-route-col">
                  {sourceSellable !== null ? (
                    <span className="prepare-transfer-route-badge">
                      <MapPin size={14} aria-hidden="true" />
                      {formatNumber(sourceSellable)} units sellable
                    </span>
                  ) : null}
                  <Field label="From" hint="Available counts in the list below are sellable stock at this location.">
                    <LocationSelect
                      value={sourceBranchId}
                      onChange={setSource}
                      onlyAccessible
                      onlyFullAccess
                      exclude={destinationBranchId}
                    />
                  </Field>
                </div>
                <div className="prepare-transfer-route-col">
                  {destLow !== null && destLow > 0 ? (
                    <span className="prepare-transfer-route-badge prepare-transfer-route-badge--gold">
                      Restock needed ({formatNumber(destLow)} {destLow === 1 ? 'item' : 'items'})
                    </span>
                  ) : null}
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
                  ? 'Optional. e.g. which shelf is empty, an event this week, or sizes that sell fast.'
                  : 'Optional. Saved on the transfer, where the receiving branch reads it.'
              }
              className="full transfer-note-field"
            >
              <textarea
                className="input prepare-transfer-note"
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                placeholder={
                  requestMode ? 'What is running low and why you need more' : 'e.g. Restock for the weekend event'
                }
              />
            </Field>
          </div>
        </Panel>

        <Panel
          title={requestMode ? '2. Products to restock' : '2. Products and quantities'}
          description={
            pickerLines.length > 0
              ? transferLinesSummary(pickerLines)
              : requestMode
                ? 'Search the catalog and add every variant that needs more units.'
                : 'Search what the source holds, then set how many to send.'
          }
          className="prepare-transfer-section"
        >
          {!catalogGateId ? (
            <div className="panel-body">
              <EmptyState
                icon={PackageSearch}
                title={requestMode ? 'Branch required' : 'Choose where the stock is coming from'}
                description={
                  requestMode
                    ? 'Your account is not linked to a branch yet. Ask a manager to assign you to a store.'
                    : 'Pick From in step 1 first. Availability is read from that location’s stock.'
                }
              />
            </div>
          ) : !catalogReady ? (
            <div className="panel-body muted">Loading catalog…</div>
          ) : (
            <div className="panel-body transfer-picker-panel prepare-transfer-picker">
              {stockBranch?.name && (
                <p className="invoice-picker-hint" role="status">
                  {requestMode
                    ? `On hand at ${stockBranch.name} (to spot sizes that are low).`
                    : `Showing variants with stock at ${stockBranch.name}. Fewer can be sent at dispatch if the shelf has moved by then.`}
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

        <div className="prepare-transfer-footer" role="region" aria-label="Transfer summary">
          <p className="prepare-transfer-footer-copy" aria-live="polite">
            {pickerLines.length > 0 ? (
              <>
                <strong className="tabular">{pieces}</strong> on {formatNumber(pickerLines.length)}{' '}
                {pickerLines.length === 1 ? 'variant' : 'variants'}
                {sourceBranch && destinationBranch ? ` · ${sourceBranch.name} → ${destinationBranch.name}` : ''}
                {!requestMode && !canSendNow && sourceBranchId
                  ? ' · saved as a draft for someone with dispatch rights at the source to send'
                  : ''}
              </>
            ) : requestMode ? (
              'Add the products you need above.'
            ) : (
              'Add products above to send them.'
            )}
          </p>
          <div className="prepare-transfer-footer-actions">
            <Link href={listHref} className="btn btn-ghost">
              Discard
            </Link>
            {canSendNow && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={submitBlocked}
                onClick={() => void submitWith('draft')}
              >
                Save as draft
              </button>
            )}
            <button type="submit" className="btn btn-primary" disabled={submitBlocked}>
              {canSendNow && !busy ? <Check size={16} aria-hidden="true" /> : null}
              {primaryLabel}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
