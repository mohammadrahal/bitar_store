'use client'

import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Drawer } from '@/components/shared/drawer'
import { Field } from '@/components/shared/field'
import { useBranches, useCreateBranch, useUpdateBranch } from '@/hooks/use-branches'
import { ApiError } from '@/lib/api'
import { buildBranchCode } from '@/lib/branch-code'
import { branchCreateSchema, emptyBranchCreateValues, type BranchCreateFormValues } from '@/schemas/branch.schema'
import type { Branch } from '@/types'

/** One form for both: with `branch` it edits, without it creates. */
export function BranchForm({ branch, onClose }: { branch?: Branch; onClose: () => void }) {
  const isEdit = Boolean(branch)
  const create = useCreateBranch()
  const update = useUpdateBranch()
  const { data: branches } = useBranches()
  const pending = create.isPending || update.isPending

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, dirtyFields },
  } = useForm<BranchCreateFormValues>({
    resolver: zodResolver(branchCreateSchema),
    defaultValues: branch
      ? { code: branch.code ?? '', name: branch.name }
      : emptyBranchCreateValues,
  })

  const name = watch('name')
  const code = watch('code')

  /* The code follows the name until the admin types their own. Clearing the
     field makes it undirty again, so the mirror picks back up. */
  useEffect(() => {
    if (isEdit || dirtyFields.code) return
    setValue('code', buildBranchCode(name))
  }, [isEdit, name, dirtyFields.code, setValue])

  /* Both clashes are caught here rather than only on the server's 409, so the
     admin is told before they submit. */
  const taken = useMemo(() => {
    const codes = new Map<string, string>()
    const names = new Map<string, string>()
    for (const other of branches ?? []) {
      if (other.id === branch?.id) continue // its own code and name are not clashes
      if (other.code) codes.set(other.code.toUpperCase(), other.name)
      names.set(other.name.trim().toLowerCase(), other.code ?? '')
    }
    return { codes, names }
  }, [branches, branch?.id])

  const codeOwner = taken.codes.get(code.trim().toUpperCase())
  const nameTaken = name.trim() ? taken.names.has(name.trim().toLowerCase()) : false
  const clashes = Boolean(codeOwner) || nameTaken

  const submit = handleSubmit((values) => {
    if (clashes) return
    if (branch) {
      /* The code is fixed after creation, so only the name travels. */
      update.mutate({ id: branch.id, changes: { name: values.name } }, { onSuccess: onClose })
      return
    }
    create.mutate(values, {
      onSuccess: onClose,
      /* Another admin may have taken the code since the list was fetched. */
      onError: (error) => {
        if (error instanceof ApiError && error.status === 409) {
          setError('code', { message: error.message || 'That code is already used.' })
        }
      },
    })
  })

  return (
    <Drawer
      eyebrow="Branches"
      title={isEdit ? `Edit ${branch?.name}` : 'New branch'}
      description={
        isEdit
          ? 'The code identifies the branch everywhere it is used, so only the display name can change.'
          : 'The code is taken from the name, stored in upper case, and must be unique across the network. Edit it if you need something different.'
      }
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending || clashes}>
            {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create branch'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field
          label="Display name"
          error={nameTaken ? `A branch is already called “${name.trim()}”.` : errors.name?.message}
          className="full"
        >
          <input {...register('name')} autoComplete="off" placeholder="Hamra" autoFocus />
        </Field>
        <Field
          label="Branch code"
          error={codeOwner ? `Code ${code.trim().toUpperCase()} belongs to ${codeOwner}.` : errors.code?.message}
          hint={
            isEdit
              ? 'Fixed after creation'
              : 'Taken from the name — type over it for a different code'
          }
          className="full"
        >
          <input {...register('code')} autoComplete="off" placeholder="HAMRA" readOnly={isEdit} />
        </Field>
      </div>
    </Drawer>
  )
}
