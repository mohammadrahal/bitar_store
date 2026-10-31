/** One numbered step of the new-model form, with its own error line. */
export function Section({
  number,
  title,
  hint,
  error,
  children,
}: {
  number: number
  title: string
  hint: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <section className="form-section" aria-labelledby={`section-${number}`}>
      <div className="form-section-head">
        <span className="section-number" aria-hidden="true">
          {number}
        </span>
        <div>
          <h2 id={`section-${number}`}>{title}</h2>
          <p>{hint}</p>
        </div>
      </div>
      {children}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
