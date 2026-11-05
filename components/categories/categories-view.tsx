'use client'

import { useEffect, useState } from 'react'
import { Tags } from 'lucide-react'
import { MotionTbody, MotionTr } from '@/components/motion/motion-table'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { SwitchToggle } from '@/components/shared/switch'
import { ApiError } from '@/lib/api'
import { apiFeatureHint, isApiFeatureMissing } from '@/lib/api/capabilities'
import type { ApiCategory } from '@/lib/api'
import { useCategoryRecords, useCreateCategory, useDeleteCategory, useUpdateCategory } from '@/hooks/use-categories'

type Dialog =
  | { kind: 'delete'; category: ApiCategory }
  | { kind: 'blocked'; category: ApiCategory; message: string }

export function CategoriesView() {
  const categoriesApiMissing = isApiFeatureMissing('categories')
  const list = useCategoryRecords(false)
  const create = useCreateCategory()
  const update = useUpdateCategory()
  const remove = useDeleteCategory()
  const [name, setName] = useState('')
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const rows = [...(list.data ?? [])].sort((a, b) => a.name.localeCompare(b.name))

  const add = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2) return
    create.mutate(trimmed, { onSuccess: () => setName('') })
  }

  if (categoriesApiMissing) {
    return (
      <>
        <PageHeader eyebrow="Catalog" title="Categories" description="Manage the category list products may use." />
        <Panel title="Not available on this server">
          <div className="panel-body">
            <EmptyState icon={Tags} title="Categories API missing" description={apiFeatureHint('categories')} />
          </div>
        </Panel>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Categories"
        description="A product can only use a category from this list. Renaming one renames it on every product."
      />

      <Panel title="All categories" description={list.isPending ? 'Loading…' : `${rows.length} ${rows.length === 1 ? 'category' : 'categories'}`}>
        <form className="toolbar" onSubmit={add}>
          <label className="toolbar-field">
            <span className="sr-only">New category</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Evening wear"
              autoComplete="off"
              maxLength={60}
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={create.isPending || name.trim().length < 2}>
            {create.isPending ? 'Adding…' : 'Add category'}
          </button>
        </form>

        {list.isPending ? (
          <div className="panel-body">
            <Skeleton rows={4} stats={0} />
          </div>
        ) : list.isError ? (
          <div className="panel-body">
            <ErrorState title="Could not load categories" error={list.error} onRetry={() => void list.refetch()} />
          </div>
        ) : rows.length === 0 ? (
          <div className="panel-body">
            <EmptyState icon={Tags} title="No categories yet" description="Add the first one above. Products pick from this list." />
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Categories</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col" className="num">Products</th>
                  <th scope="col">Active</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <MotionTbody>
                {rows.map((category, index) => (
                  <CategoryRow
                    key={category.id}
                    category={category}
                    index={index}
                    pending={update.isPending && update.variables?.id === category.id}
                    onRename={(next) => update.mutate({ id: category.id, name: next })}
                    onActive={(isActive) => update.mutate({ id: category.id, isActive })}
                    onDelete={() => setDialog({ kind: 'delete', category })}
                  />
                ))}
              </MotionTbody>
            </table>
          </div>
        )}
      </Panel>

      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title={`Delete ${dialog.category.name}?`}
          description={
            dialog.category.productCount > 0
              ? `${dialog.category.productCount} product(s) use this category. If the server refuses, deactivate it instead.`
              : 'This cannot be undone. Products will not be able to use this name.'
          }
          confirmLabel="Delete"
          tone="danger"
          onResolve={(confirmed) => {
            const category = dialog.category
            setDialog(null)
            if (!confirmed) return
            remove.mutate(category.id, {
              onError: (error) => {
                if (error instanceof ApiError && error.status === 409) {
                  setDialog({ kind: 'blocked', category, message: error.message })
                }
              },
            })
          }}
        />
      )}

      {dialog?.kind === 'blocked' && (
        <ConfirmDialog
          title={`${dialog.category.name} is in use`}
          description={dialog.message}
          confirmLabel="Deactivate"
          tone="danger"
          onResolve={(confirmed) => {
            const category = dialog.category
            setDialog(null)
            if (confirmed) update.mutate({ id: category.id, isActive: false })
          }}
        />
      )}
    </>
  )
}

function CategoryRow({
  category,
  index,
  pending,
  onRename,
  onActive,
  onDelete,
}: {
  category: ApiCategory
  index: number
  pending: boolean
  onRename: (name: string) => void
  onActive: (isActive: boolean) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(category.name)

  useEffect(() => {
    setName(category.name)
  }, [category.name])

  const commit = () => {
    const trimmed = name.trim()
    if (trimmed.length < 2 || trimmed === category.name) {
      setName(category.name)
      return
    }
    onRename(trimmed)
  }

  return (
    <MotionTr index={index}>
      <td>
        <input
          value={name}
          aria-label={`Rename ${category.name}`}
          onChange={(event) => setName(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              event.currentTarget.blur()
            }
          }}
          disabled={pending}
          maxLength={60}
        />
      </td>
      <td className="num">{category.productCount}</td>
      <td>
        <SwitchToggle
          checked={category.isActive}
          disabled={pending}
          label={`${category.isActive ? 'Deactivate' : 'Activate'} ${category.name}`}
          onCheckedChange={onActive}
        />
      </td>
      <td>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onDelete}>
          Delete
        </button>
      </td>
    </MotionTr>
  )
}
