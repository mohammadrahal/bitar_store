'use client'

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartTooltip } from '@/components/dashboard/chart-tooltip'
import { createSegmentShape } from '@/components/dashboard/chart-marks'
import { CHART_GRID, CHART_TEXT, MARK_THICKNESS, seriesColor } from '@/lib/chart-palette'
import { CURRENCY, formatCurrency, formatNumber, formatPrice } from '@/lib/format'
import type { SalesAnalytics } from '@/types'

const ROW_HEIGHT = 44
const AXIS_HEIGHT = 48
const SERIES_ID = 'revenue'

interface Row extends Record<string, unknown> {
  branchId: string
  branchName: string
  revenue: number
  units: number
}

/** Single series, so every row's bar is the one that rounds and carries its value. */
const outermost = () => SERIES_ID

/**
 * Revenue per branch. Each bar keeps its branch's colour from the top-sellers
 * chart, so identity is consistent across the page, and the axis names every
 * bar, so identity never rests on colour alone.
 */
export function BranchSalesChart({ analytics }: { analytics: SalesAnalytics }) {
  const colorIndexOf = new Map(analytics.series.map((entry, index) => [entry.id, index]))
  const rows: Row[] = analytics.byBranch.map((branch) => ({
    branchId: branch.branchId,
    branchName: branch.branchName,
    revenue: branch.revenue,
    units: branch.units,
  }))

  const height = Math.max(rows.length * ROW_HEIGHT + AXIS_HEIGHT, 180)

  return (
    <div className="chart-block">
      <div role="img" aria-label="Net sales revenue by branch">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 72, bottom: 0, left: 0 }} accessibilityLayer>
            <CartesianGrid horizontal={false} stroke={CHART_GRID} strokeWidth={1} />
            <XAxis
              type="number"
              tickFormatter={(value: number) => formatCurrency(value, CURRENCY, true)}
              stroke={CHART_GRID}
              tick={{ fill: CHART_TEXT, fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="branchName"
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
                    title={row.branchName}
                    rows={[
                      {
                        id: row.branchId,
                        name: 'Revenue',
                        value: formatPrice(row.revenue),
                        colorIndex: colorIndexOf.get(row.branchId) ?? 0,
                      },
                    ]}
                    footer={`${formatNumber(row.units)} units sold`}
                  />
                )
              }}
            />
            <Bar
              dataKey={SERIES_ID}
              name="Revenue"
              barSize={MARK_THICKNESS}
              shape={createSegmentShape(SERIES_ID, outermost, (row) => formatPrice(row.revenue as number))}
              isAnimationActive={false}
            >
              {rows.map((row) => (
                <Cell key={row.branchId} fill={seriesColor(row.branchId, colorIndexOf.get(row.branchId) ?? 0)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
