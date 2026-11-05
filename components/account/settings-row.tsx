import type { ReactNode } from 'react'

export function SettingsCard({ children }: { children: ReactNode }) {
  return <section className="settings-card">{children}</section>
}

export function SettingsSectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <header className="settings-section-head">
      <h2 className="settings-section-title">{title}</h2>
      {description && <p className="settings-section-desc">{description}</p>}
    </header>
  )
}

export function SettingsRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="settings-row">
      <div className="settings-row-label">
        <p className="settings-row-title">{label}</p>
        {description && <p className="settings-row-desc">{description}</p>}
      </div>
      <div className="settings-row-field">{children}</div>
    </div>
  )
}
