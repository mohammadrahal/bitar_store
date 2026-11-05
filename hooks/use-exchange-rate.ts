'use client'

import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getExchangeRate, getExchangeRateHistory, saveExchangeRate } from '@/services/exchange-rate.service'
import { useCurrentUser } from '@/store/user-store'

export const exchangeRateQueryKey = ['settings', 'exchange-rate'] as const
const STORAGE_KEY = 'bitar:exchange-rate:v1'

export function useExchangeRate() {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: exchangeRateQueryKey,
    queryFn: () => getExchangeRate(),
    staleTime: 60_000,
  })

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) client.invalidateQueries({ queryKey: exchangeRateQueryKey })
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [client])

  return query
}

export function useExchangeRateHistory() {
  return useQuery({
    queryKey: [...exchangeRateQueryKey, 'history'] as const,
    queryFn: () => getExchangeRateHistory(),
    staleTime: 60_000,
  })
}

export function useSaveExchangeRate() {
  const user = useCurrentUser()
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (usdToLbp: number) => saveExchangeRate(usdToLbp, user.name),
    onSuccess: (row) => {
      client.setQueryData(exchangeRateQueryKey, row)
      void client.invalidateQueries({ queryKey: [...exchangeRateQueryKey, 'history'] })
      toast.success('Exchange rate updated')
    },
    onError: () => toast.error('Could not save the exchange rate'),
  })
}
