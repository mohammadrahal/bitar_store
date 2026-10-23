'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import { ArrowDown, ArrowLeftRight, ArrowUp, Download, PackagePlus, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useDashboardUI } from '@/components/dashboard/dashboard-ui-provider'
import { EmptyState, PageHeader, Pagination, Panel, StatusPill } from '@/components/dashboard/primitives'
import { useInventory } from '@/components/inventory/inventory-provider'
import { useSearchState } from '@/hooks/use-query-state'
import { datedFilename, downloadFile, toCsv } from '@/lib/csv'
import { formatCurrency, formatNumber } from '@/lib/format'
import { selectCategories, selectProductRows, type ProductRow } from '@/lib/inventory/selectors'
import { ALL_BRANCHES } from '@/lib/inventory/types'

const PAGE_SIZE = 10
const DEFAULT_PARAMS = { status: 'all', category: 'all', sort: 'name', dir: 'asc', page: '1' }

type SortKey = 'name' | 'sku' | 'category' | 'onHand' | 'available' | 'value'
type StatusFilter = 'all' | 'attention' | 'healthy' | 'low' | 'out'

const columns: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'sku', label: 'SKU' },
  { key: 'name', label: 'Product' },
  { key: 'category', label: 'Category' },
  { key: 'onHand', label: 'On hand', numeric: true },
  { key: 'available', label: 'Available', numeric: true },
  { key: 'value', label: 'Value', numeric: true },
]

function compare(a: ProductRow, b: ProductRow, key: SortKey) {
  const x = a[key]
  const y = b[key]
  return typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
}

export function ProductsView() {
  const { state, scope, branchName, deleteProduct } = useInventory()
  const { openDrawer, confirm } = useDashboardUI()

  const [params, setParams] = useSearchState(DEFAULT_PARAMS)
  const [search, setSearch] = useState('')
  const query = useDeferredValue(search.trim().toLowerCase())

  const status = params.status as StatusFilter
  const category = params.category
  const sort = (columns.some((c) => c.key === params.sort) ? params.sort : 'name') as SortKey
  const dir = params.dir === 'desc' ? 'desc' : 'asc'

  const rows = useMemo(() => selectProductRows(state, scope), [state, scope])
  const categories = useMemo(() => selectCategories(state.products), [state.products])

  const filtered = useMemo(() => {
    const result = rows.filter((r) => {
      if (status === 'attention' ? r.status === 'healthy' : status !== 'all' && r.status !== status) return false
      if (category !== 'all' && r.category !== category) return false
      if (query && !`${r.name} ${r.sku} ${r.category}`.toLowerCase().includes(query)) return false
      return true
    })
    result.sort((a, b) => compare(a, b, sort) * (dir === 'asc' ? 1 : -1))
    return result
  }, [rows, status, category, query, sort, dir])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const page = Math.min(pageCount, Math.max(1, Number(params.page) || 1))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function toggleSort(key: SortKey) {
    if (sort === key) setParams({ dir: dir === 'asc' ? 'desc' : 'asc' })
    else setParams({ sort: key, dir: columns.find((c) => c.key === key)?.numeric ? 'desc' : 'asc' })
  }

  async function remove(row: ProductRow) {
    const ok = await confirm({
      title: `Delete ${row.name}?`,
      description: row.onHand
        ? `${formatNumber(row.onHand)} units across ${row.levels.length} branch(es) will be removed from inventory. Movement history is kept.`
        : 'The product will be removed from the catalog. Movement history is kept.',
      confirmLabel: 'Delete product',
      tone: 'danger',
    })
    if (!ok) return
    const result = deleteProduct(row.id)
    if (result.ok) toast.success(`Deleted “${row.name}”`)
    else toast.error(result.error)
  }

  function exportCsv() {
    const csv = toCsv(
      ['SKU', 'Product', 'Category', 'Price', 'Reorder point', 'On hand', 'Reserved', 'Available', 'Value', 'Status'],
      filtered.map((r) => [r.sku, r.name, r.category, r.price, r.reorderPoint, r.onHand, r.reserved, r.available, r.value, r.status]),
    )
    downloadFile(datedFilename('bitar-products', 'csv'), csv)
    toast.success(`Exported ${filtered.length} products`)
  }

  const hasFilters = status !== 'all' || category !== 'all' || query !== ''

  return (
    <>
      <PageHeader
        title="Products"
        description={scope === ALL_BRANCHES ? 'Catalog and stock across every branch.' : `Products stocked at ${branchName(scope)}.`}
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={exportCsv} disabled={!filtered.length}>
              <Download size={16} /> Export CSV
            </button>
            <button type="button" className="btn btn-primary" onClick={() => openDrawer({ kind: 'product' })}>
              <Plus size={16} /> Add product
            </button>
          </>
        }
      />

      <Panel title="Product catalog" description={`${formatNumber(filtered.length)} of ${formatNumber(rows.length)} products`}>
        <div className="toolbar">
          <label className="search-field">
            <Search size={15} aria-hidden="true" />
            <span className="sr-only">Search products</span>
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, SKU, category…" />
          </label>
          <label className="select-inline">
            <span className="sr-only">Status</span>
            <select value={status} onChange={(e) => setParams({ status: e.target.value })}>
              <option value="all">All statuses</option>
              <option value="attention">Needs attention</option>
              <option value="healthy">Healthy</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
          </label>
          <label className="select-inline">
            <span className="sr-only">Category</span>
            <select value={category} onChange={(e) => setParams({ category: e.target.value })}>
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          {hasFilters && (
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                setSearch('')
                setParams({ status: 'all', category: 'all' })
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={PackagePlus}
            title={rows.length ? 'No products match' : 'No products yet'}
            description={rows.length ? 'Try a different search or clear the filters.' : 'Add your first product to start tracking stock.'}
            action={
              !rows.length && (
                <button type="button" className="btn btn-primary" onClick={() => openDrawer({ kind: 'product' })}>
                  <Plus size={16} /> Add product
                </button>
              )
            }
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} scope="col" className={c.numeric ? 'num' : undefined} aria-sort={sort === c.key ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                      <button type="button" className="sort-btn" onClick={() => toggleSort(c.key)}>
                        {c.label}
                        {sort === c.key && (dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                      </button>
                    </th>
                  ))}
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id}>
                    <td className="reference">{p.sku}</td>
                    <td>
                      <button type="button" className="link-cell" onClick={() => openDrawer({ kind: 'product', productId: p.id })}>
                        {p.name}
                      </button>
                      <small>
                        {formatCurrency(p.price, state.settings.currency)} · min {p.reorderPoint}/branch
                      </small>
                    </td>
                    <td>{p.category}</td>
                    <td className="num tabular">{formatNumber(p.onHand)}</td>
                    <td className="num tabular">{formatNumber(p.available)}</td>
                    <td className="num tabular">{formatCurrency(p.value, state.settings.currency)}</td>
                    <td>
                      <StatusPill status={p.status} />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          title="Record stock"
                          aria-label={`Record stock for ${p.name}`}
                          onClick={() => openDrawer({ kind: 'stock', productId: p.id, branchId: scope === ALL_BRANCHES ? p.levels[0]?.branchId : scope })}
                        >
                          <PackagePlus size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          title="Transfer"
                          aria-label={`Transfer ${p.name}`}
                          disabled={p.available <= 0}
                          onClick={() =>
                            openDrawer({
                              kind: 'transfer',
                              productId: p.id,
                              fromBranchId: scope === ALL_BRANCHES ? [...p.levels].sort((a, b) => b.onHand - a.onHand)[0]?.branchId : scope,
                            })
                          }
                        >
                          <ArrowLeftRight size={15} />
                        </button>
                        <button type="button" className="icon-btn" title="Edit" aria-label={`Edit ${p.name}`} onClick={() => openDrawer({ kind: 'product', productId: p.id })}>
                          <Pencil size={15} />
                        </button>
                        <button type="button" className="icon-btn danger" title="Delete" aria-label={`Delete ${p.name}`} onClick={() => remove(p)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPage={(p) => setParams({ page: String(p) })} />
      </Panel>
    </>
  )
}
