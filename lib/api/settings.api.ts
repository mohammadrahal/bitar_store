import type { RequestFn } from '@/lib/api/client'
import type { ApiSettings, UpdateSettingsInput } from '@/lib/api/types'

/**
 * `GET/PUT /settings`: the one row of business-wide rules.
 *
 * Reading is open to any signed-in user, because the till needs the exchange
 * rate and the return window. Writing needs `settings.manage`.
 */
export function createSettingsApi(request: RequestFn) {
  return {
    getSettings: () => request<ApiSettings>('/settings'),
    /** Partial body. An unknown key is a 400, so send only what changed. */
    updateSettings: (input: UpdateSettingsInput) => request<ApiSettings>('/settings', 'PUT', input),
  }
}

export type SettingsApi = ReturnType<typeof createSettingsApi>
