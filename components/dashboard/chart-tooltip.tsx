'use client'

import { seriesColor } from '@/lib/chart-palette'

export interface TooltipRow {
  id: string
  name: string
  value: string
  colorIndex: number
}

/**
 * The hover layer every chart here ships with. Identity comes from the swatch
 * beside the label, never from colouring the text.
 */
export function ChartTooltip({ title, rows, footer }: { title: string; rows: TooltipRow[]; footer?: string }) {
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-title">{title}</p>
      <ul>
        {rows.map((row) => (
          <li key={row.id}>
            <span className="chart-swatch" style={{ background: seriesColor(row.id, row.colorIndex) }} aria-hidden="true" />
            <span>{row.name}</span>
            <strong className="tabular">{row.value}</strong>
          </li>
        ))}
      </ul>
      {footer && <p className="chart-tooltip-footer">{footer}</p>}
    </div>
  )
}

/** The legend: always present once two series share a chart. */
export function ChartLegend({ series }: { series: { id: string; name: string }[] }) {
  if (series.length < 2) return null

  return (
    <ul className="chart-legend">
      {series.map((entry, index) => (
        <li key={entry.id}>
          <span className="chart-swatch" style={{ background: seriesColor(entry.id, index) }} aria-hidden="true" />
          {entry.name}
        </li>
      ))}
    </ul>
  )
}
