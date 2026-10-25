export function Skeleton({ rows = 3, stats = 4 }: { rows?: number; stats?: number }) {
  return (
    <div className="skeleton-wrap" aria-busy="true" aria-label="Loading">
      <div className="skeleton skeleton-title" />
      {stats > 0 && (
        <div className="stats-grid">
          {Array.from({ length: stats }, (_, index) => (
            <div key={index} className="skeleton skeleton-card" />
          ))}
        </div>
      )}
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton skeleton-row" />
      ))}
    </div>
  )
}
