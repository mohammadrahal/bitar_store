'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Drawer } from '@/components/shared/drawer'
import { Field } from '@/components/shared/field'
import { useCreateBranch } from '@/hooks/use-branches'
import { branchCreateSchema, emptyBranchCreateValues, type BranchCreateFormValues } from '@/schemas/branch.schema'

export function BranchForm({ onClose }: { onClose: () => void }) {
  const create = useCreateBranch()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BranchCreateFormValues>({
    resolver: zodResolver(branchCreateSchema),
    defaultValues: emptyBranchCreateValues,
  })

  const submit = handleSubmit((values) => {
    create.mutate(values, { onSuccess: onClose })
  })

  return (
    <Drawer
      eyebrow="Branches"
      title="New branch"
      description="The code is stored in upper case and must be unique across the network."
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={create.isPending}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create branch'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Branch code" error={errors.code?.message} hint="e.g. HAMRA" className="full">
          <input {...register('code')} autoComplete="off" placeholder="hamra" />
        </Field>
        <Field label="Display name" error={errors.name?.message} className="full">
          <input {...register('name')} autoComplete="off" placeholder="Hamra" />
        </Field>
      </div>
    </Drawer>
  )
}
