'use client'

import { FadeIn } from '@/components/motion/fade-in'
import { SettingsCard, SettingsRow } from '@/components/account/settings-row'
import { SelectInput } from '@/components/shared/select-input'
import { useBranches } from '@/hooks/use-branches'
import { useUserPreferences } from '@/hooks/use-user-preferences'
import { usePermission } from '@/hooks/use-permission'
import { applyResolvedTheme, resolveThemePreference } from '@/lib/theme'
import type { TableDensity, ThemePreference } from '@/services/user-preferences.service'
import { useUIStore } from '@/store/ui-store'
import { isLocationScoped } from '@/lib/permissions'

const themeOptions: { value: ThemePreference; label: string; preview: 'light' | 'dark' | 'split' }[] = [
  { value: 'light', label: 'Light', preview: 'light' },
  { value: 'dark', label: 'Dark', preview: 'dark' },
  { value: 'system', label: 'System', preview: 'split' },
]

function ThemePreview({ kind }: { kind: 'light' | 'dark' | 'split' }) {
  if (kind === 'split') {
    return (
      <span className="theme-preview theme-preview-split" aria-hidden="true">
        <span className="theme-preview-half light" />
        <span className="theme-preview-half dark" />
      </span>
    )
  }
  return <span className={`theme-preview theme-preview-${kind}`} aria-hidden="true" />
}

export function PreferencesTab() {
  const { user } = usePermission()
  const { data: branches } = useBranches()
  const { preferences, update } = useUserPreferences()
  const setTheme = useUIStore((state) => state.setTheme)

  const locationOptions = (() => {
    if (!isLocationScoped(user)) {
      return branches?.map((branch) => ({ value: branch.id, label: branch.name })) ?? []
    }
    return user.locations.map((entry) => {
      const branch = branches?.find((candidate) => candidate.id === entry.locationId)
      return {
        value: entry.locationId,
        label: `${branch?.name ?? 'Location'}${entry.access === 'view_only' ? ' (view only)' : ''}`,
      }
    })
  })()

  const setThemePreference = (theme: ThemePreference) => {
    update({ theme })
    const resolved = resolveThemePreference(theme)
    setTheme(resolved)
    applyResolvedTheme(resolved)
  }

  return (
    <FadeIn className="settings-page">
      <SettingsCard>
        <SettingsRow label="Theme" description="Choose light, dark, or follow your device. Stored on this browser.">
          <div className="segmented theme-segmented" role="group" aria-label="Theme">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={preferences.theme === option.value ? 'active' : ''}
                aria-pressed={preferences.theme === option.value}
                onClick={() => setThemePreference(option.value)}
              >
                <ThemePreview kind={option.preview} />
                {option.label}
              </button>
            ))}
          </div>
        </SettingsRow>

        {locationOptions.length > 0 && (
          <SettingsRow
            label="Default location on sign-in"
            description="When you have more than one assignment, this location is selected automatically."
          >
            <SelectInput
              className="settings-select"
              aria-label="Default location on sign-in"
              value={preferences.defaultLocationId ?? ''}
              onValueChange={(value) => update({ defaultLocationId: value || null })}
              placeholder="Ask each time"
              options={[{ value: '', label: 'Ask each time' }, ...locationOptions]}
            />
          </SettingsRow>
        )}

        <SettingsRow label="Table density" description="How much vertical space lists use across the app.">
          <div className="segmented" role="group" aria-label="Table density">
            {(
              [
                { value: 'comfortable' as const, label: 'Comfortable' },
                { value: 'compact' as const, label: 'Compact' },
              ] satisfies { value: TableDensity; label: string }[]
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                className={preferences.tableDensity === option.value ? 'active' : ''}
                aria-pressed={preferences.tableDensity === option.value}
                onClick={() => update({ tableDensity: option.value })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </SettingsRow>
      </SettingsCard>
    </FadeIn>
  )
}
