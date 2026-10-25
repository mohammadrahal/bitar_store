import { cloneElement, isValidElement, useId, type ReactElement } from 'react'

export function Field({
  label,
  error,
  hint,
  className,
  affix,
  children,
}: {
  label: string
  error?: string
  hint?: string
  className?: string
  /** Control sitting inside the input, such as a password reveal toggle. */
  affix?: React.ReactNode
  children: ReactElement<Record<string, unknown>>
}) {
  const id = useId()
  const messageId = `${id}-message`
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error || hint ? messageId : undefined,
      })
    : children

  return (
    <div className={`field ${className ?? ''}`}>
      <label htmlFor={id}>{label}</label>
      {affix ? (
        <div className="field-affix">
          {control}
          {affix}
        </div>
      ) : (
        control
      )}
      {(error || hint) && (
        <span id={messageId} className={error ? 'field-error' : 'field-hint'}>
          {error ?? hint}
        </span>
      )}
    </div>
  )
}
