'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isApiFeatureMissing } from '@/lib/api/capabilities'
import { queryKeys } from '@/lib/query-keys'
import { toApiRole } from '@/services/session.service'
import { getPermissionCatalog, getUserPermissions, setUserPermissions } from '@/services/users.service'
import { isOwnerRole } from '@/lib/permissions'
import type { Role } from '@/types'

export function permissionChanges(original: Record<string, boolean>, wanted: Record<string, boolean>) {
  const changes: Record<string, boolean> = {}
  for (const key of Object.keys(wanted)) {
    if (Boolean(wanted[key]) !== Boolean(original[key])) changes[key] = Boolean(wanted[key])
  }
  return changes
}

export function usePermissionCatalog(enabled = true) {
  return useQuery({
    queryKey: queryKeys.users.permissionCatalog(),
    queryFn: getPermissionCatalog,
    enabled: enabled && !isApiFeatureMissing('permissions'),
    staleTime: 5 * 60_000,
  })
}

export function useUserPermissions(userId: string) {
  return useQuery({
    queryKey: queryKeys.users.permissions(userId),
    queryFn: () => getUserPermissions(userId),
    enabled: Boolean(userId),
  })
}

/**
 * Checkbox state for one person. Role defaults come from `GET /permissions`.
 * An existing user starts from `GET /users/:id/permissions`.
 */
export function usePermissionDraft(role: Role, userId: string | undefined) {
  const owner = isOwnerRole(role)
  const catalog = usePermissionCatalog(!owner)
  const saved = useUserPermissions(!owner && userId ? userId : '')
  const [wanted, setWanted] = useState<Record<string, boolean> | null>(null)
  const originalRef = useRef<Record<string, boolean>>({})
  const signatureRef = useRef('')

  useEffect(() => {
    if (owner) {
      originalRef.current = {}
      setWanted({})
      return
    }
    if (!catalog.data) return
    if (userId && saved.isPending) return

    const apiRole = toApiRole(role)
    const sameRole = Boolean(userId) && saved.data?.user.role === apiRole
    const signature = `${userId ?? 'new'}:${apiRole}:${saved.dataUpdatedAt}:${sameRole}`
    if (signatureRef.current === signature) return
    signatureRef.current = signature

    const defaults = new Set(catalog.data.roles[apiRole] ?? [])
    const next: Record<string, boolean> = {}
    for (const permission of catalog.data.permissions) {
      if (!permission.grantable) continue
      if (sameRole) {
        const line = saved.data?.permissions.find((entry) => entry.key === permission.key)
        next[permission.key] = line ? line.allowed : defaults.has(permission.key)
      } else {
        next[permission.key] = defaults.has(permission.key)
      }
    }
    originalRef.current = next
    setWanted(next)
  }, [catalog.data, owner, role, saved.data, saved.dataUpdatedAt, saved.isPending, userId])

  return {
    catalog,
    saved,
    wanted,
    setWanted,
    ready: owner || wanted !== null,
    changes: () => permissionChanges(originalRef.current, wanted ?? {}),
  }
}

export function useSetUserPermissions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, permissions }: { id: string; name: string; permissions: Record<string, boolean> }) =>
      setUserPermissions(id, permissions),
    onSuccess: (_data, { id, name }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.permissions(id) })
      toast.success(`Permissions saved for ${name}. They take effect on their next request. Refresh the page if they are already signed in.`)
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
