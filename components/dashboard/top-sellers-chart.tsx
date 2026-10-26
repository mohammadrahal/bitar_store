'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartLegend, ChartTooltip } from '@/components/dashboard/chart-tooltip'
import { createSegmentShape } from '@/components/dashboard/chart-marks'
import { outermostSeries } from '@/lib/chart-geometry'
import { CHART_GRID, CHART_TEXT, MARK_THICKNESS, seriesColor } from '@/lib/chart-palette'
import { formatNumber, formatPrice } from '@/lib/format'
import type { SalesAnalytics } from '@/types'

const ROW_HEIGHT = 34
const AXIS_HEIGHT = 48

interface Row extends Record<string, unknown> {
  productName: string
  units: number
  revenue: number
}

export function TopSellersChart({ analytics }: { analytics: SalesAnalytics }) {
  const { series, topProducts } = analytics
  const rows: Row[] = topProducts.map((product) => ({
    productName: product.productName,
    units: product.units,
    revenue: product.revenue,
    ...Object.fromEntries(series.map((entry) => [entry.id, product.byBranch[entry.id] ?? 0])),
  }))

  const seriesIds = series.map((entry) => entry.id)
  const outermost = (row: Record<string, unknown>) => outermostSeries(seriesIds, row)
  const height = Math.max(rows.length * ROW_HEIGHT + AXIS_HEIGHT, 200)
  const label = `Top ${rows.length} products by units sold${series.length > 1 ? ', split by branch' : ''}`

  return (
    <div className="chart-block">
      <ChartLegend series={series} />
      <div role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 48, bottom: 0, left: 0 }} accessibilityLayer>
            <CartesianGrid horizontal={false} stroke={CHART_GRID} strokeWidth={1} />
            <XAxis
              type="number"
              tickFormatter={(value: number) => formatNumber(value)}
              stroke={CHART_GRID}
              tick={{ fill: CHART_TEXT, fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="productName"
              width={132}
              stroke={CHART_GRID}
              tick={{ fill: CHART_TEXT, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: CHART_GRID, fillOpacity: 0.35 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const row = payload[0].payload as Row
                return (
                  <ChartTooltip
                    title={row.productName}
                    rows={series
                      .map((entry, index) => ({
                        id: entry.id,
                        name: entry.name,
                        value: formatNumber((row[entry.id] as number) ?? 0),
                        colorIndex: index,
                      }))
                      .filter((item) => item.value !== '0')}
                    footer={`${formatNumber(row.units)} units · ${formatPrice(row.revenue)}`}
                  />
                )
              }}
            />
            {series.map((entry, index) => (
              <Bar
                key={entry.id}
                dataKey={entry.id}
                name={entry.name}
                stackId="units"
                fill={seriesColor(entry.id, index)}
                barSize={MARK_THICKNESS}
                shape={createSegmentShape(entry.id, outermost, (row) => formatNumber(row.units as number))}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
