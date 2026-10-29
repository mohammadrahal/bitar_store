'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { queryKeys } from '@/lib/query-keys'
import { archiveAllActiveStyles } from '@/services/catalog-reset.service'

export function ArchiveAllDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const archive = useMutation({
    mutationFn: archiveAllActiveStyles,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
      if (result.errors.length === 0) {
        toast.success(`Archived ${result.archived} model${result.archived === 1 ? '' : 's'}. Add new ones when ready.`)
      } else {
        toast.warning(`Archived ${result.archived}; ${result.errors.length} failed (server may block models with stock).`)
      }
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <ConfirmDialog
      title="Archive every model?"
      description="Deactivates all active styles on the server and clears the catalog cache on this device. The API keeps archived records; there is no hard delete. Branch stock on the server is not removed—you may need the backend to adjust stock separately."
      confirmLabel={archive.isPending ? 'Archiving…' : 'Archive all'}
      tone="danger"
      onResolve={(confirmed) => {
        onClose()
        if (confirmed && !archive.isPending) archive.mutate()
      }}
    />
  )
}
