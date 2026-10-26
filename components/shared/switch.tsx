'use client'

export function SwitchToggle({
  checked,
  onCheckedChange,
  disabled,
  id,
  label,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  id?: string
  /** Spoken label for screen readers. */
  label: string
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      className="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
    >
      <span className="switch-thumb" aria-hidden="true" />
    </button>
  )
}

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  id,
  label,
  description,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  id?: string
  label: string
  description?: string
}) {
  return (
    <div className="switch-field">
      <div className="switch-copy">
        <label htmlFor={id}>{label}</label>
        {description ? <p>{description}</p> : null}
      </div>
      <SwitchToggle id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} label={label} />
    </div>
  )
}
