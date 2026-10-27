'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMirroredBranches } from '@/hooks/use-stock'
import { queryKeys } from '@/lib/query-keys'
import { addColor, listColors } from '@/services/attributes.service'
import type { ColorOption } from '@/types'

export function useColors() {
  const mirrored = useMirroredBranches()
  return useQuery({ queryKey: queryKeys.attributes.colors(), queryFn: listColors, enabled: mirrored !== null })
}

/* Errors are shown beside the "Add a color" input, so there is no toast here. */
export function useAddColor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ColorOption) => addColor(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.attributes.all }),
  })
}
