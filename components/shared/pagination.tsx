import { ChevronLeft, ChevronRight } from 'lucide-react'

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPage,
}: {
  page: number
  pageCount: number
  total: number
  pageSize: number
  onPage: (page: number) => void
}) {
  if (total <= pageSize) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)

  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="muted tabular">
        {from}–{to} of {total}
      </span>
      <div>
        <button type="button" className="icon-btn" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft size={16} />
        </button>
        <span className="tabular">
          {page} / {pageCount}
        </span>
        <button type="button" className="icon-btn" onClick={() => onPage(page + 1)} disabled={page >= pageCount} aria-label="Next page">
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  )
}
