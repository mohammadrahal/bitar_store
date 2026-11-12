'use client'

import { useState } from 'react'
import { ClipboardList, Trash2 } from 'lucide-react'
import { MotionTbody, MotionTr } from '@/components/motion/motion-table'
import { useConfirm } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { Field } from '@/components/shared/field'
import { ErrorState } from '@/components/shared/error-state'
import { LocationSelect } from '@/components/shared/location-select'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { SearchInput } from '@/components/shared/search-input'
import { Skeleton } from '@/components/shared/skeleton'
import { SkuTableCell } from '@/components/shared/table-empty'
import { useAllowPageBranchFilter, useEffectiveListBranchId } from '@/hooks/use-branch-scope'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { usePermission } from '@/hooks/use-permission'
import { Pagination } from '@/components/shared/pagination'
import { usePagination } from '@/hooks/use-pagination'
import { useDeleteReorderLevel, useReorderLevels, useSetReorderLevel } from '@/hooks/use-warehouse'

export function ReorderLevelsView() {
  const allowPageBranchFilter = useAllowPageBranchFilter()
  const [pageBranchId, setPageBranchId] = useState('')
  const branchId = useEffectiveListBranchId(pageBranchId)
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput)
  const [skuId, setSkuId] = useState('')
  const [minQuantity, setMinQuantity] = useState('0')
  const [targetQuantity, setTargetQuantity] = useState('')

  const list = useReorderLevels(branchId, search)
  const save = useSetReorderLevel()
  const remove = useDeleteReorderLevel()
  const [confirm, confirmDialog] = useConfirm()
  const rows = list.data ?? []
  const pagination = usePagination(rows, 20, `${branchId}:${search}`)

  const addMinimum = (event: React.FormEvent) => {
    event.preventDefault()
    if (!branchId || !skuId.trim()) return
    save.mutate({
      branchId,
      skuId: skuId.trim(),
      minQuantity: Math.max(0, Math.floor(Number(minQuantity))),
      targetQuantity: targetQuantity.trim() ? Math.max(0, Math.floor(Number(targetQuantity))) : undefined,
    })
  }

  return (
    <>
      <PageHeader
        eyebrow="Warehouse"
        title="Branch minimums"
        description="How many sellable units each branch should keep per variant. The warehouse has no minimum."
      />

      <Panel title="Current minimums">
        <div className="toolbar">
          {allowPageBranchFilter && (
            <div className="toolbar-field">
              <LocationSelect
                value={pageBranchId}
                onChange={setPageBranchId}
                onlyAccessible
                onlyFullAccess
                placeholder="Choose a branch"
                aria-label="Branch"
              />
            </div>
          )}
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search SKU or style"
            aria-label="Search minimums"
          />
        </div>

        {!branchId ? (
          <div className="panel-body">
            <EmptyState
              icon={ClipboardList}
              title="Choose a branch"
              description="Pick a branch above to view or set minimum stock levels."
            />
          </div>
        ) : list.isPending ? (
          <div className="panel-body">
            <Skeleton rows={4} stats={0} />
          </div>
        ) : list.isError ? (
          <div className="panel-body">
            <ErrorState title="Could not load minimums" error={list.error} onRetry={() => void list.refetch()} />
          </div>
        ) : rows.length === 0 ? (
          <div className="panel-body">
            <EmptyState
              icon={ClipboardList}
              title="No minimums yet"
              description="Set a minimum below, or add one with the form under this table."
            />
          </div>
        ) : (
          <>
          <div className="table-wrap">
            <table className="card-table">
              <caption className="sr-only">Reorder levels for the selected branch</caption>
              <thead>
                <tr>
                  <th scope="col">SKU</th>
                  <th scope="col" className="num">
                    Minimum
                  </th>
                  <th scope="col" className="num">
                    Target
                  </th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <MotionTbody>
                {pagination.visible.map((row, index) => (
                  <MotionTr key={row.id} index={index}>
                    <SkuTableCell
                      code={row.sku.code}
                      styleName={row.sku.styleName}
                      color={row.sku.color}
                      size={row.sku.size}
                    />
                    <td className="num">{row.minQuantity}</td>
                    <td className="num">{row.targetQuantity ?? ''}</td>
                    <td className="row-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm danger"
                        aria-label="Remove minimum"
                        onClick={async () => {
                          const confirmed = await confirm({
                            title: `Remove the minimum for ${row.sku.code}?`,
                            description: 'This SKU will no longer be flagged as low stock at this branch.',
                            confirmLabel: 'Remove',
                            tone: 'danger',
                          })
                          if (confirmed) remove.mutate(row.id)
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </MotionTr>
                ))}
              </MotionTbody>
            </table>
          </div>
          <Pagination
            page={pagination.page}
            pageCount={pagination.pageCount}
            total={pagination.total}
            pageSize={pagination.pageSize}
            onPage={pagination.setPage}
          />
          </>
        )}
      </Panel>

      {branchId && (
        <Panel title="Set minimum">
          <form className="panel-body form-grid" onSubmit={addMinimum}>
            <Field label="SKU id">
              <input type="text" className="input" value={skuId} onChange={(event) => setSkuId(event.target.value)} />
            </Field>
            <Field label="Minimum">
              <input
                type="number"
                inputMode="numeric"
                step={1}
                className="input"
                min={0}
                value={minQuantity}
                onChange={(event) => setMinQuantity(event.target.value)}
              />
            </Field>
            <Field label="Target (optional)">
              <input
                type="number"
                inputMode="numeric"
                step={1}
                className="input"
                min={0}
                value={targetQuantity}
                onChange={(event) => setTargetQuantity(event.target.value)}
              />
            </Field>
            <div className="form-actions align-end">
              <button type="submit" className="btn btn-primary" disabled={save.isPending}>
                Save
              </button>
            </div>
          </form>
        </Panel>
      )}
      {confirmDialog}
    </>
  )
}
