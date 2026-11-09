'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'
import { messageOf } from '@/lib/errors'
import {
  SETTINGS_FALLBACK,
  exchangeRateOf,
  getSettings,
  updateSettings,
} from '@/services/settings.service'
import type { UpdateSettingsInput } from '@/lib/api/types'

/**
 * `GET /settings`: one row, read by every signed-in user.
 *
 * Everything on the till that used to be a constant in the code or a key in
 * `localStorage` comes from here: the USD/LBP rate, the return window, the
 * default reservation, and whether a sale needs an open drawer.
 */
export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings.store(),
    queryFn: getSettings,
    /* Business rules change a few times a year, not a few times a minute, and
       every price on every screen reads the rate off this one query. */
    staleTime: 5 * 60_000,
  })
}

/** The settings with the documented defaults filled in, for screens that cannot wait. */
export function useSettingsOrDefaults() {
  const query = useSettings()
  return query.data ?? SETTINGS_FALLBACK
}

/** Just the USD → LBP rate: whole pounds, or `null` when none is set. */
export function useExchangeRate() {
  const query = useSettings()
  return { ...query, rate: exchangeRateOf(query.data) }
}

/** How many days a sale may be returned within. Never hardcode this. */
export function useReturnPeriodDays(): number {
  return useSettingsOrDefaults().returnPeriodDays
}

/** When true, a sale at a branch with no open drawer is refused with a 409. */
export function useRequiresOpenCashSession(): boolean {
  return useSettingsOrDefaults().requireOpenCashSession
}

/**
 * `PUT /settings`, for `settings.manage`.
 *
 * Only the changed fields are sent: an unknown key is a 400, and sending the
 * whole row back would overwrite a field another manager had just changed.
 */
export function useUpdateSettings() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateSettingsInput) => updateSettings(input),
    onSuccess: (settings) => {
      client.setQueryData(queryKeys.settings.store(), settings)
      toast.success('Settings saved')
    },
    onError: (error) => toast.error(messageOf(error) ?? 'Could not save the settings'),
  })
}

/** The exchange rate on its own, which is the only setting with its own screen. */
export function useSaveExchangeRate() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (exchangeRateUsdLbp: number | null) => updateSettings({ exchangeRateUsdLbp }),
    onSuccess: (settings) => {
      client.setQueryData(queryKeys.settings.store(), settings)
      toast.success(
        settings.exchangeRateUsdLbp === null ? 'Exchange rate cleared' : 'Exchange rate updated',
      )
    },
    onError: (error) => toast.error(messageOf(error) ?? 'Could not save the exchange rate'),
  })
}
