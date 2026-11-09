'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { Drawer } from '@/components/shared/drawer'
import { Field } from '@/components/shared/field'
import { LocationSelect } from '@/components/shared/location-select'
import { useBranchScope } from '@/hooks/use-branch-scope'
import { useBranches } from '@/hooks/use-branches'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { useVariantDetails, useWarehouseId } from '@/hooks/use-inventory'
import { usePermission } from '@/hooks/use-permission'
import { useCreateTransfer, useDispatchTransfer } from '@/hooks/use-transfers'
import { formatNumber } from '@/lib/format'
import { WAREHOUSE_NOT_LINKED_MESSAGE } from '@/lib/warehouse-messages'
import { ALL_BRANCHES } from '@/types'
import { useUIStore } from '@/store/ui-store'

export interface QuickTransferVariant {
  variantId: string
  /** `Model · Colour / Size`, as the table already reads it. */
  label: string
  sku: string
}

/**
 * Sending stock without leaving the list.
 *
 * `/transfers/new` asks for the route, then the variants, then the quantities —
 * and the variant is the one thing the person was already looking at when they
 * decided to send it. Searching the catalog again for a row that is on screen
 * is the whole cost of that page, so this drawer takes the selection as given
 * and asks only what is undecided: where to, how many, go.
 *
 * It makes the same two writes `/transfers/new` makes (`POST /transfers` then
 * `POST /transfers/:id/dispatch`, a separate idempotency key each), so nothing
 * about the record or the audit trail differs from a transfer prepared the long
 * way. A dispatch that fails leaves the saved draft behind and navigates to it,
 * because that work must never evaporate; the happy path stays on the list,
 * which is the point of the drawer.
 */
export function QuickTransferDrawer({
  variants,
  initialSourceId,
  initialDestinationId,
  initialQuantities,
  onClose,
  onDone,
}: {
  variants: QuickTransferVariant[]
  /** Pre-chosen source: a location row, or the branch filter in the header. */
  initialSourceId?: string
  /**
   * Pre-chosen destination, for a list that already names one — a replenishment
   * suggestion knows the branch that is short, so asking again is a question
   * with one answer.
   */
  initialDestinationId?: string
  /** Pieces per variant, where the caller has a figure worth starting from. */
  initialQuantities?: Record<string, number>
  onClose: () => void
  /** Called after a successful send, to clear whatever drove the selection. */
  onDone?: () => void
}) {
  const router = useRouter()
  const scope = useBranchScope()
  const { data: branches } = useBranches()
  const {
    user,
    canAccessLocation,
    locationAccess,
    canDispatchTransfers,
    canReceiveTransfers,
    locationScoped,
    activeLocationId,
  } = usePermission()
  /* Branch staff may only ask the warehouse to restock their own branch: the
     rule `/transfers/new` applies and the server enforces. */
  const requestMode = canReceiveTransfers() && !canDispatchTransfers()

  const details = useVariantDetails(variants.map((variant) => variant.variantId))
  const loading = details.some((detail) => detail.isPending)

  const create = useCreateTransfer()
  const dispatch = useDispatchTransfer()
  const createKey = useIdempotencyKey()
  const dispatchKey = useIdempotencyKey()

  const lastDestinationId = useUIStore((state) => state.lastTransferDestinationId)
  const rememberDestination = useUIStore((state) => state.setLastTransferDestinationId)

  const assignedBranchId = (locationScoped ? activeLocationId : null) ?? user.branchIds[0] ?? user.branchId ?? ''

  const [source, setSource] = useState(() => (requestMode ? '' : (initialSourceId ?? '')))
  const [destination, setDestination] = useState(() =>
    requestMode ? assignedBranchId : (initialDestinationId ?? ''),
  )
  const [quantities, setQuantities] = useState<Record<string, number>>(() => ({ ...initialQuantities }))
  const [note, setNote] = useState('')

  const { data: warehouseId, refetch: refetchWarehouse } = useWarehouseId(
    requestMode ? destination || assignedBranchId : undefined,
  )
  useEffect(() => {
    if (requestMode && warehouseId) setSource(warehouseId)
  }, [requestMode, warehouseId])

  /** Every location holding this selection that the viewer may act for. */
  const candidates = useMemo(() => {
    const byId = new Map<string, { branchId: string; branchName: string; available: number }>()
    for (const detail of details) {
      for (const location of detail.data?.locations ?? []) {
        if (locationAccess(location.branchId) !== 'full') continue
        const current = byId.get(location.branchId)
        byId.set(location.branchId, {
          branchId: location.branchId,
          branchName: location.branchName,
          available: (current?.available ?? 0) + location.available,
        })
      }
    }
    return [...byId.values()].sort((a, b) => b.available - a.available)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details.map((detail) => detail.dataUpdatedAt).join('|'), locationAccess])

  /* The source is chosen for them when there is an obvious one: the row this
     was opened from, the branch the header is filtered to, or failing both the
     location that holds the most of the selection. Never the destination: a
     route whose two ends are the same cannot be sent, and silently picking the
     place the stock is going is how a shipment ends up pointing backwards. */
  useEffect(() => {
    if (requestMode || source || candidates.length === 0) return
    if (scope !== ALL_BRANCHES && scope !== destination && candidates.some((option) => option.branchId === scope)) {
      setSource(scope)
      return
    }
    const best = candidates.find((option) => option.available > 0 && option.branchId !== destination)
    if (best) setSource(best.branchId)
  }, [requestMode, source, candidates, scope, destination])

  /** The last destination used on this device, which for most shifts is the one. */
  useEffect(() => {
    if (requestMode || destination || !lastDestinationId) return
    if (lastDestinationId === source) return
    if (locationAccess(lastDestinationId) !== 'full') return
    setDestination(lastDestinationId)
  }, [requestMode, destination, lastDestinationId, source, locationAccess])

  const balanceAt = (variantId: string, branchId: string) => {
    const index = variants.findIndex((variant) => variant.variantId === variantId)
    const detail = details[index]?.data
    return detail?.locations.find((location) => location.branchId === branchId)
  }
  const availableAt = (variantId: string, branchId: string) => balanceAt(variantId, branchId)?.available ?? 0

  const quantityOf = (variantId: string) => quantities[variantId] ?? 1
  const setQuantity = (variantId: string, next: number) =>
    setQuantities((current) => ({
      ...current,
      [variantId]: Number.isFinite(next) ? Math.max(0, Math.floor(next)) : 0,
    }))

  const lines = variants
    .map((variant) => ({ variant, quantity: quantityOf(variant.variantId) }))
    .filter((line) => line.quantity > 0)
  const units = lines.reduce((sum, line) => sum + line.quantity, 0)
  /* A request asks for stock the branch has not got, so the figure beside it is
     advisory. A transfer moves real units, so what the source holds is a cap. */
  const over = requestMode
    ? []
    : lines.filter((line) => line.quantity > availableAt(line.variant.variantId, source))

  /**
   * Both ends spelled out, warehouse named as such.
   *
   * The selects alone were not enough: when a drawer opens with From and To
   * already filled from the header filter and the last shipment, nobody has
   * read either of them, and "Send now" is one click away from a route pointing
   * the wrong way. This line is the route in words, and the button repeats the
   * destination, so sending the wrong way has to be read past twice.
   */
  const nameOf = (branchId: string) => {
    if (!branchId) return ''
    const name =
      branches?.find((branch) => branch.id === branchId)?.name ??
      candidates.find((option) => option.branchId === branchId)?.branchName ??
      ''
    return name && branchId === warehouseId ? `${name} (warehouse)` : name
  }
  const sourceName = nameOf(source) || undefined
  const destinationName = nameOf(destination) || undefined

  const problem = !destination
    ? requestMode
      ? 'Your account is not linked to a branch yet. Ask a manager to assign you to a store.'
      : 'Choose where the stock is going.'
    : !source
      ? requestMode
        ? WAREHOUSE_NOT_LINKED_MESSAGE
        : 'Choose where the stock is coming from.'
      : source === destination
        ? 'Pick two different locations.'
        : lines.length === 0
          ? 'Enter how many pieces to send.'
          : over.length > 0
            ? `Only ${formatNumber(availableAt(over[0].variant.variantId, source))} available at ${
                sourceName ?? 'the source'
              }. Lower the quantity, or send from another location.`
            : null

  /* Sending moves stock, so it needs dispatch rights at the source: the check
     `/transfers/:id` makes before it shows its own Send button. */
  const canSendNow = !requestMode && canDispatchTransfers() && Boolean(source) && canAccessLocation(source)
  const busy = create.isPending || dispatch.isPending

  const submit = async (mode: 'send' | 'draft') => {
    if (problem || busy) return
    let sourceId = source
    if (!sourceId && requestMode) {
      const resolved = await refetchWarehouse()
      sourceId = resolved.data ?? ''
      if (!sourceId) {
        toast.error(WAREHOUSE_NOT_LINKED_MESSAGE)
        return
      }
    }

    let transferId = ''
    try {
      const transfer = await create.mutateAsync({
        input: {
          sourceBranchId: sourceId,
          destinationBranchId: destination,
          note: note.trim() ? note.trim() : undefined,
          lines: lines.map((line) => ({ skuId: line.variant.variantId, quantity: line.quantity })),
        },
        idempotencyKey: createKey.current(),
      })
      transferId = transfer.id
      createKey.reset()
    } catch {
      /* `useCreateTransfer` has already said why. Stay open, so the quantities
         someone just typed are still here to retry with. */
      return
    }

    if (!requestMode) rememberDestination(destination)

    if (mode === 'draft') {
      onDone?.()
      onClose()
      router.push(`/transfers/${transferId}`)
      return
    }

    try {
      await dispatch.mutateAsync({ id: transferId, idempotencyKey: dispatchKey.current() })
      dispatchKey.reset()
    } catch {
      /* The hook has toasted. The draft is real, so go to it: the shortage list
         and the Send button are there and the work is not lost. */
      onClose()
      router.push(`/transfers/${transferId}`)
      return
    }
    onDone?.()
    onClose()
  }

  const title =
    variants.length === 1
      ? variants[0].label
      : `${variants.length} variants · ${formatNumber(units)} ${units === 1 ? 'piece' : 'pieces'}`

  return (
    <Drawer
      eyebrow={requestMode ? 'Request restock' : 'Send stock'}
      title={title}
      description={variants.length === 1 ? variants[0].sku : 'Quantities below are what leaves the source.'}
      onClose={onClose}
      onSubmit={() => void submit(canSendNow ? 'send' : 'draft')}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {canSendNow && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={Boolean(problem) || busy}
              onClick={() => void submit('draft')}
            >
              Save as draft
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={Boolean(problem) || busy}>
            {busy
              ? 'Sending…'
              : canSendNow
                ? destinationName
                  ? `Send to ${destinationName}`
                  : 'Send now'
                : requestMode
                  ? 'Submit request'
                  : 'Save draft'}
          </button>
        </>
      }
    >
      {requestMode ? (
        <dl className="detail-grid-fields detail-grid-fields--2">
          <div>
            <dt>From</dt>
            <dd>{sourceName ?? 'Main warehouse'}</dd>
          </div>
          <div>
            <dt>To</dt>
            <dd>{destination ? 'Your branch' : '—'}</dd>
          </div>
        </dl>
      ) : (
        <div className="form-grid">
          <Field label="From" hint={source ? 'Available below is sellable stock there.' : undefined}>
            <LocationSelect value={source} onChange={setSource} onlyAccessible onlyFullAccess exclude={destination} />
          </Field>
          <Field label="To">
            <LocationSelect
              value={destination}
              onChange={setDestination}
              onlyAccessible
              onlyFullAccess
              exclude={source}
            />
          </Field>
        </div>
      )}

      {!requestMode && (
        <p className="quick-move-route" role="status">
          <span className="quick-move-route-end">{sourceName ?? 'Choose a source'}</span>
          <ArrowRight size={15} aria-hidden="true" />
          <span className="quick-move-route-end">{destinationName ?? 'Choose a destination'}</span>
        </p>
      )}

      <div className="table-wrap quick-move-table-wrap">
        <table className="card-table quick-move-table">
          <caption className="sr-only">What is moving, and what the source is left with</caption>
          <thead>
            <tr>
              <th scope="col">Variant</th>
              <th scope="col" className="num">
                {requestMode ? 'You have' : 'Available'}
              </th>
              <th scope="col" className="num">
                Send
              </th>
              <th scope="col" className="num">
                Left
              </th>
            </tr>
          </thead>
          <tbody>
            {variants.map((variant) => {
              const quantity = quantityOf(variant.variantId)
              const available = availableAt(variant.variantId, requestMode ? destination : source)
              const exceeds = !requestMode && quantity > available
              return (
                <tr key={variant.variantId}>
                  <td className="card-title">
                    <strong>{variant.label}</strong>
                    <small className="tabular">{variant.sku}</small>
                  </td>
                  <td className="num tabular" data-label={requestMode ? 'You have' : 'Available'}>
                    {loading ? '…' : formatNumber(available)}
                  </td>
                  <td className="num" data-label="Send">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      className="invoice-qty-input tabular"
                      value={quantity}
                      aria-invalid={exceeds || undefined}
                      aria-label={`Pieces of ${variant.label} to send`}
                      onChange={(event) => setQuantity(variant.variantId, Number(event.target.value))}
                    />
                  </td>
                  <td className="num tabular" data-label="Left">
                    {loading || requestMode ? (
                      '—'
                    ) : (
                      <span className={exceeds ? 'quick-move-short' : undefined}>
                        {formatNumber(available - quantity)}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!requestMode && source && destination && lines.length > 0 && (
        <p className="field-hint" role="status">
          {formatNumber(units)} {units === 1 ? 'piece' : 'pieces'} leave {sourceName ?? 'the source'} when this is
          sent and travel as in transit. They land on hold at the destination and become sellable there once the
          branch receives and accepts them.
        </p>
      )}

      <Field
        label="Note"
        hint={
          requestMode ? 'Optional. Which shelf is empty, or an event this week.' : 'Optional. Saved on the transfer.'
        }
      >
        <textarea
          className="input"
          rows={2}
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={requestMode ? 'What is running low and why' : 'Shipment note'}
        />
      </Field>

      {problem && (
        <p className="field-hint" role="status">
          {problem}
        </p>
      )}
    </Drawer>
  )
}
