'use client'

import { useMemo, useState } from 'react'
import { formatNumber, formatShortDate } from '@/lib/format'
import type { ActivityPoint } from '@/lib/inventory/selectors'

const WIDTH = 720
const HEIGHT = 200

function niceMax(value: number) {
  if (value <= 0) return 10
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const steps = [1, 2, 2.5, 5, 10]
  const step = steps.find((s) => s * magnitude >= value) ?? 10
  return step * magnitude
}

function buildPath(values: number[], max: number) {
  if (values.length === 1) return `M0 ${HEIGHT - (values[0] / max) * HEIGHT} H${WIDTH}`
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * WIDTH
      const y = HEIGHT - (v / max) * HEIGHT
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

export function StockChart({ data }: { data: ActivityPoint[] }) {
  const [hover, setHover] = useState<number | null>(null)

  const { max, inPath, outPath, inArea, ticks, labels, totals } = useMemo(() => {
    const max = niceMax(Math.max(...data.map((d) => Math.max(d.inbound, d.outbound)), 0))
    const inPath = buildPath(data.map((d) => d.inbound), max)
    const outPath = buildPath(data.map((d) => d.outbound), max)
    const labelCount = Math.min(5, data.length)
    const labels = Array.from({ length: labelCount }, (_, i) => data[Math.round((i / Math.max(1, labelCount - 1)) * (data.length - 1))])
    return {
      max,
      inPath,
      outPath,
      inArea: `${inPath} L${WIDTH} ${HEIGHT} L0 ${HEIGHT} Z`,
      ticks: [max, (max * 2) / 3, max / 3, 0].map((v) => Math.round(v)),
      labels,
      totals: data.reduce((acc, d) => ({ inbound: acc.inbound + d.inbound, outbound: acc.outbound + d.outbound }), { inbound: 0, outbound: 0 }),
    }
  }, [data])

  const point = hover !== null ? data[hover] : null
  const hoverX = hover !== null ? (data.length > 1 ? (hover / (data.length - 1)) * 100 : 50) : 0

  return (
    <figure className="chart-figure">
      <div className="chart-legend">
        <span>
          <i className="legend-in" aria-hidden="true" />
          Stock in <strong className="tabular">{formatNumber(totals.inbound)}</strong>
        </span>
        <span>
          <i className="legend-out" aria-hidden="true" />
          Stock out <strong className="tabular">{formatNumber(totals.outbound)}</strong>
        </span>
      </div>
      <div className="chart">
        <div className="chart-y" aria-hidden="true">
          {ticks.map((t, i) => (
            <span key={i}>{formatNumber(t)}</span>
          ))}
        </div>
        <div
          className="chart-area"
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
            setHover(Math.round(ratio * (data.length - 1)))
          }}
          onPointerLeave={() => setHover(null)}
        >
          <div className="grid-lines" aria-hidden="true">
            {ticks.map((_, i) => (
              <i key={i} />
            ))}
          </div>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={`Stock in ${totals.inbound} units, stock out ${totals.outbound} units over ${data.length} days. Peak ${max} units per day.`}>
            <defs>
              <linearGradient id="chart-in-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={inArea} fill="url(#chart-in-fill)" />
            <path d={outPath} fill="none" stroke="var(--chart-out)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            <path d={inPath} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </svg>
          {point && (
            <>
              <div className="chart-cursor" style={{ left: `${hoverX}%` }} aria-hidden="true" />
              <div className={`chart-tooltip ${hoverX > 70 ? 'flip' : ''}`} style={{ left: `${hoverX}%` }}>
                <strong>{formatShortDate(point.date)}</strong>
                <span>
                  <i className="legend-in" /> In {formatNumber(point.inbound)}
                </span>
                <span>
                  <i className="legend-out" /> Out {formatNumber(point.outbound)}
                </span>
              </div>
            </>
          )}
          <div className="chart-x" aria-hidden="true">
            {labels.map((d, i) => (
              <span key={i}>{formatShortDate(d.date)}</span>
            ))}
          </div>
        </div>
      </div>
    </figure>
  )
}
