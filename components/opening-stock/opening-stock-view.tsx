'use client'

import { useEffect, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Field } from '@/components/shared/field'
import { LocationSelect } from '@/components/shared/location-select'
import { PageHeader } from '@/components/shared/page-header'
import { ViewOnlyNotice } from '@/components/shared/view-only-notice'
import { Panel } from '@/components/shared/panel'
import { SearchInput } from '@/components/shared/search-input'
import { Skeleton } from '@/components/shared/skeleton'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useDefaultBranchId } from '@/hooks/use-branch-scope'
import { useOpeningState, usePostOpeningStock } from '@/hooks/use-opening-stock'
import { usePermission } from '@/hooks/use-permission'
import { useStockPicker } from '@/hooks/use-inventory'

const LIMIT = 60
const SEARCH_DEBOUNCE_MS = 250

/**
 * The counted opening quantity for a location: BL-010 section 3. Staff with
 * `counts.enter` fill the sheet in; an owner role reviews and posts it, once.
 * Creating a model never places stock, so this is how a location starts.
 */
export function OpeningStockView() {
  const { can, locationScoped } = usePermission()
  const defaultBranch = useDefaultBranchId()
  const [branchChoice, setBranchChoice] = useState('')
  const branchId = locationScoped ? defaultBranch : branchChoice
  const mayPost = can('opening_stock.post', branchId || undefined)

  const [search, setSearch] = useState('')
  const term = useDebouncedValue(search, SEARCH_DEBOUNCE_MS)
  const [counted, setCounted] = useState<Record<string, number>>({})

  const variants = useStockPicker(branchId, term, LIMIT)
  const opening = useOpeningState(branchId)
  const submit = usePostOpeningStock()

  useEffect(() => {
    setCounted({})
  }, [branchId])

  const lines = Object.values(counted).filter((quantity) => quantity > 0).length
  const units = Object.values(counted).reduce((sum, quantity) => sum + quantity, 0)
  /* A SKU already in play at this location cannot be opened again, so the sheet
     leaves it out: what is left is whatever the catalog gained since. */
  const moved = new Set(opening.data?.movedSkuIds ?? [])
  const openable = (variants.data ?? []).filter((option) => !moved.has(option.variantId))

  return (
    <>
      <PageHeader
        eyebrow="Stock"
        title="Opening stock"
        description="Count what is physically at a location and post it. A SKU is opened once; after that its differences are settled by a physical count."
      />

      {!locationScoped && (
        <Field label="Location">
          <LocationSelect
            value={branchChoice}
            onChange={setBranchChoice}
            onlyAccessible
            onlyFullAccess
            placeholder="Select a location"
          />
        </Field>
      )}

      <ViewOnlyNotice locationId={branchId} action="post an opening count" />

      {!branchId ? (
        <EmptyState
          icon={ClipboardList}
          title="Pick a location"
          description="Opening quantities belong to one location, so choose where you are counting."
        />
      ) : (
        <Panel
          title="Counted quantities"
          description={
            lines === 0
              ? 'Enter what you counted. Variants left blank stay at zero.'
              : `${lines} ${lines === 1 ? 'line' : 'lines'}, ${units} ${units === 1 ? 'unit' : 'units'}`
          }
          actions={
            <SearchInput
              value={search}
              onChange={setSearch}
              aria-label="Search variants"
              placeholder="Model, SKU or barcode"
            />
          }
        >
          <p className="panel-body muted">
            Only SKUs that have never moved at this location can be opened, so anything already in play is left off
            the sheet.
          </p>
          {variants.isPending || opening.isPending ? (
            <div className="panel-body">
              <Skeleton rows={4} stats={0} />
            </div>
          ) : variants.isError ? (
            <div className="panel-body">
              <ErrorState
                title="Could not load the catalog"
                error={variants.error}
                onRetry={() => void variants.refetch()}
              />
            </div>
          ) : openable.length === 0 ? (
            <div className="panel-body">
              <EmptyState
                icon={ClipboardList}
                title="Nothing left to open here"
                description="Every SKU in this search has already moved at this location, or the catalog has none yet."
              />
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table className="card-table">
                  <caption className="sr-only">Opening quantity per variant</caption>
                  <thead>
                    <tr>
                      <th scope="col">Variant</th>
                      <th scope="col">SKU</th>
                      <th scope="col">Counted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openable.map((option) => (
                      <tr key={option.variantId}>
                        <td className="card-title" data-label="Variant">
                          {option.productName} — {option.color} / {option.size}
                        </td>
                        <td data-label="SKU" className="tabular">
                          {option.sku}
                        </td>
                        <td data-label="Counted">
                          <input
                            className="qty-input tabular"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            value={counted[option.variantId] ?? ''}
                            placeholder="0"
                            aria-label={`Counted units of ${option.productName} ${option.color} / ${option.size}`}
                            onChange={(event) => {
                              const parsed = Math.floor(Number(event.target.value))
                              setCounted((current) => ({
                                ...current,
                                [option.variantId]: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
                              }))
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="panel-body action-bar">
                {mayPost ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={lines === 0 || submit.isPending}
                    onClick={() => submit.mutate({ branchId, quantities: counted })}
                  >
                    {submit.isPending ? 'Posting…' : 'Post opening stock'}
                  </button>
                ) : (
                  <p className="muted">
                    A super admin or manager reviews and posts this sheet. Your counts are not saved until they do.
                  </p>
                )}
              </div>
            </>
          )}
        </Panel>
      )}
    </>
  )
}
