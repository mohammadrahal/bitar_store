'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useCatalogSync } from '@/hooks/use-stock'
import { ArrowLeft, Check, MapPin, PackageSearch, ShieldCheck } from 'lucide-react'
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
import { readDb } from '@/mocks/store'
import { WarehouseLinkNotice } from '@/components/shared/warehouse-link-notice'
import { WAREHOUSE_NOT_LINKED_MESSAGE } from '@/lib/warehouse-messages'
import { resolveWarehouseId } from '@/services/warehouse-link.service'
import { useCurrentUser } from '@/store/user-store'
import type { Branch } from '@/types'

const FORM_ID = 'prepare-transfer-form'

export function NewTransferView() {
  const router = useRouter()
  const user = useCurrentUser()
  const create = useCreateTransfer()
  const idempotency = useIdempotencyKey()
  const dispatchKey = useIdempotencyKey()
  const dispatchTransfer = useDispatchTransfer()
  const {
    user: permissionUser,
    canAccessLocation,
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

  const canSendNow =
    !requestMode && canDispatchTransfers() && Boolean(sourceBranchId) && canAccessLocation(sourceBranchId)

  const primaryLabel = canSendNow
    ? busy
      ? 'Sending…'
      : 'Review & submit transfer'
    : busy
      ? 'Saving…'
      : requestMode
        ? 'Submit replenishment request'
        : 'Save as pending draft'

  const headerActions = !requestMode ? (
    <div className="heading-actions prepare-transfer-header-actions">
      <button
        type="button"
        className="btn btn-secondary"
        disabled={submitBlocked}
        onClick={() => void submitWith('draft')}
      >
        Save as draft
      </button>
      {canSendNow ? (
        <button
          type="button"
          className="btn btn-primary"
          disabled={submitBlocked}
          onClick={() => void submitWith('send')}
        >
          <Check size={16} aria-hidden="true" />
          Review & submit transfer
        </button>
      ) : (
        <button type="submit" form={FORM_ID} className="btn btn-primary" disabled={submitBlocked}>
          {primaryLabel}
        </button>
      )}
    </div>
  ) : undefined

  return (
    <div className="prepare-transfer-page">
      <Link href={requestMode ? '/inventory?section=receiving' : '/transfers'} className="back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        {requestMode ? 'Back to your requests' : 'Back to transfers overview'}
      </Link>

      <PageHeader
        eyebrow={requestMode ? 'Inventory · Replenishment' : 'Warehouse logistics · Dispatches'}
        title={requestMode ? 'Request replenishment' : 'Prepare transfer'}
        description={
          requestMode
            ? 'Tell the team which variants to send when your branch is low or sold out. Nothing moves until the warehouse dispatches.'
            : 'Draft a shipment and allocate stock. Nothing moves physically until authorized dispatch rights send it.'
        }
        actions={headerActions}
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
        <Panel
          title={requestMode ? '1. Your branch' : '1. Route & logistics specifications'}
          className="prepare-transfer-section"
        >
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
                  <Field
                    label="Source location (from)"
                    hint="Available counts in the list below are sellable stock at this location."
                  >
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
                  <Field label="Destination location (to)">
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
              label={requestMode ? 'Details for the team' : 'Dispatch manifest & handling directives'}
              hint={
                requestMode
                  ? 'Optional. e.g. which shelf is empty, an event this week, or sizes that sell fast.'
                  : 'Optional note saved on the transfer — handling, priority, or seal references your team uses offline.'
              }
              className="full transfer-note-field"
            >
              <textarea
                className="input prepare-transfer-note"
                rows={4}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                placeholder={
                  requestMode
                    ? 'What is running low and why you need more'
                    : 'e.g. VIP event restock — inspect cartons before release to floor'
                }
              />
            </Field>
          </div>
        </Panel>

        <Panel
          title={requestMode ? '2. Products to restock' : '2. Allocated variants & quantities'}
          description={
            pickerLines.length > 0
              ? transferLinesSummary(pickerLines)
              : requestMode
                ? 'Search the catalog and add every variant that needs more units.'
                : 'Search stocked variants at the source, then set quantities for this dispatch.'
          }
          className="prepare-transfer-section"
        >
          {!catalogGateId ? (
            <div className="panel-body">
              <EmptyState
                icon={PackageSearch}
                title={requestMode ? 'Branch required' : 'Source location required'}
                description={
                  requestMode
                    ? 'Your account is not linked to a branch yet. Ask a manager to assign you to a store.'
                    : 'Choose the source location in step 1 first. Availability is read from that branch’s stock.'
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
                    : `Showing variants with stock at ${stockBranch.name}. Dispatch may send fewer than requested if shelves move.`}
                </p>
              )}
              <TransferLinePicker
                branchId={linePickerBranchId}
                lines={pickerLines}
                onChange={setPickerLines}
                purpose={requestMode ? 'replenishment' : 'transfer'}
              />
              {pickerLines.length > 0 ? (
                <div className="prepare-transfer-batch-summary" aria-live="polite">
                  <span className="tabular">
                    <strong>{formatNumber(pickerLines.length)}</strong> variants
                  </span>
                  <span className="prepare-transfer-batch-dot" aria-hidden="true" />
                  <span className="tabular">
                    <strong>{formatNumber(totalUnits)}</strong> physical units
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </Panel>

        {!requestMode ? (
          <div className="prepare-transfer-auth-grid">
            <section className="prepare-transfer-auth-card prepare-transfer-auth-card--active" aria-labelledby="dispatch-auth-title">
              <ShieldCheck size={20} aria-hidden="true" />
              <h3 id="dispatch-auth-title">Authorized dispatch rights</h3>
              <p className="prepare-transfer-auth-name">{user.name}</p>
              <p className="muted prepare-transfer-auth-detail">
                {canSendNow
                  ? 'You can submit and dispatch from the selected source in one step.'
                  : 'You can save a draft. Dispatch must be done by someone with rights at the source.'}
              </p>
            </section>
            <section className="prepare-transfer-auth-card" aria-labelledby="dispatch-docs-title">
              <h3 id="dispatch-docs-title">After submit</h3>
              <p className="muted">
                Open the transfer to print the receiving report or raise a supply invoice when the shipment leaves the
                warehouse.
              </p>
            </section>
          </div>
        ) : null}

        <div className="prepare-transfer-footer" role="region" aria-label="Transfer summary">
          <p className="prepare-transfer-footer-copy">
            {pickerLines.length > 0 ? (
              <>
                Ready for dispatch scheduling:{' '}
                <strong className="tabular">{formatNumber(totalUnits)}</strong> total items allocated
              </>
            ) : (
              'Add variants above to schedule this dispatch.'
            )}
          </p>
          <div className="prepare-transfer-footer-actions">
            <Link href="/transfers" className="btn btn-ghost">
              Discard
            </Link>
            {canSendNow ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={submitBlocked}
                  onClick={() => void submitWith('draft')}
                >
                  Save as pending draft
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitBlocked}>
                  {busy ? 'Sending…' : 'Authorize & submit transfer'}
                </button>
              </>
            ) : (
              <button type="submit" className="btn btn-primary" disabled={submitBlocked}>
                {primaryLabel}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
