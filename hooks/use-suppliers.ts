'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'
import { messageOf } from '@/lib/errors'
import {
  createSupplier,
  deactivateSupplier,
  listActiveSuppliers,
  listSuppliers,
  reactivateSupplier,
  updateSupplier,
} from '@/services/suppliers.service'
import type { CreateSupplierInput, UpdateSupplierInput } from '@/lib/api/types'

/** The picker on a goods receipt: active suppliers, by name. */
export function useActiveSuppliers(search = '', enabled = true) {
  return useQuery({
    queryKey: queryKeys.suppliers.list(search, 'active', 0),
    queryFn: () => listActiveSuppliers(search),
    enabled,
    staleTime: 60_000,
  })
}

/** The admin list, where inactive suppliers are shown too. */
export function useSuppliers(search = '', active?: boolean, offset = 0) {
  return useQuery({
    queryKey: queryKeys.suppliers.list(search, active === undefined ? 'all' : String(active), offset),
    queryFn: () => listSuppliers({ search: search || undefined, active, offset, limit: 50 }),
    staleTime: 60_000,
  })
}

export function useCreateSupplier() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSupplierInput) => createSupplier(input),
    onSuccess: async (supplier) => {
      await client.invalidateQueries({ queryKey: queryKeys.suppliers.all })
      toast.success(`${supplier.name} added`)
    },
    onError: (error) => toast.error(messageOf(error) ?? 'Could not add the supplier'),
  })
}

export function useUpdateSupplier() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSupplierInput }) => updateSupplier(id, input),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: queryKeys.suppliers.all })
      toast.success('Supplier updated')
    },
    onError: (error) => toast.error(messageOf(error) ?? 'Could not update the supplier'),
  })
}

/**
 * Switching a supplier off, which is the nearest thing to deleting one: the
 * receipts that name it have to keep resolving, so the record stays.
 */
export function useSetSupplierActive() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? reactivateSupplier(id) : deactivateSupplier(id),
    onSuccess: async (supplier) => {
      await client.invalidateQueries({ queryKey: queryKeys.suppliers.all })
      toast.success(supplier.isActive ? `${supplier.name} is active again` : `${supplier.name} switched off`)
    },
    onError: (error) => toast.error(messageOf(error) ?? 'Could not change the supplier'),
  })
}
